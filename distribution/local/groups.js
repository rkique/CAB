// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

// const groups = require("../all/groups.js");

/**
 * @param {string} name
 * @param {Callback} callback
 */

const _groups = Object.create(null);

function get(name, callback) {
  callback = callback || (() => {});
  const distribution = globalThis.distribution;

  if (!_groups.all) _groups.all = Object.create(null);

  if (!_groups.local) {
    const self = distribution?.node?.config;

    if (self && typeof self.ip === "string" && typeof self.port !== "undefined"){
      const id = distribution?.util?.id;

      const sid = 
        (id && typeof id.getSID === "function" && id.getSID(self)) ||
        (id && typeof id.getNID === "function" && id.getNID(self)) ||
        `${self.ip}:${self.port}`;

        _groups.local = Object.create(null);
        _groups.local[sid] = { ip: self.ip, port: self.port};
    } else {
      _groups.local = Object.create(null);
    }
  }

  for (const sid of Object.keys(_groups.local)) {
    _groups.all[sid] = _groups.local[sid];
  }

  if (typeof name !== "string") {
    return callback(new Error("groups.get: name must be a string"));
  }

  const g = _groups[name];

  if(!g) return callback(new Error(`groups.get: unknown group '${name}'`));

  return callback(null, Object.assign({}, g));
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  callback = callback || (() => {});
  const distribution = globalThis.distribution;

  if (!_groups.all) _groups.all = Object.create(null);

  if(!_groups.local) {
    const self = distribution?.node?.config;
    if (self && typeof self.ip === "string" && typeof self.port !== "undefined") {
      const id = distribution?.util?.id;
      const sid = 
      (id && typeof id.getSID === "function" && id.getSID(self)) ||
      (id && typeof id.getNID === "function" && id.getNID(self)) ||
      `${self.ip}:${self.port}`;

      _groups.local = Object.create(null);
      _groups.local[sid] = { ip: self.ip, port: self.port};
    } else  {
      _groups.local = Object.create(null);
    }
  }

  for (const sid of Object.keys(_groups.local)) {
    _groups.all[sid] = _groups.local[sid];
  }

  let gid;
  if (typeof config === "string") gid = config;
  else if (config && typeof config === "object" && typeof config.gid === "string") gid = config.gid;

  if (!gid) return callback(new Error("groups.put: missing gid (use a string or {gid: ...})"));

  const normalized = Object.create(null);
  if (group && typeof group === "object") {
    for (const sid of Object.keys(group)) {
      const n = group[sid];
      if (n && typeof n === "object" && typeof n.ip === "string" && typeof n.port != "undefined") {
        normalized[sid] = {ip: n.ip, port: n.port};
      }
    }
  }

  _groups[gid] = normalized;

  for(const sid of Object.keys(normalized)) {
    _groups.all[sid] = normalized[sid];
  }

  if (gid != "local" && gid !== "all") {
    const setup = distribution?.__setup;
    if (typeof setup === "function") {
      distribution[gid] = setup({ gid });
    } else {
      return callback(new Error("groups.put: missing distribution.all.__setup"), null);
    }
  }
  return callback(null, Object.assign({}, normalized));

}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  callback = callback || (() => {});
  const distribution = globalThis.distribution;

  if (typeof name !== "string") {
    return callback(new Error("groups.del: name must be a string"), null);
  }
  if (name === "all" || name === "local") {
    return callback(new Error(`groups.del: cannot delete builtin '${name}'`), null);
  }

  const g = _groups[name];
  if (!g) return callback(new Error(`groups.del: unknown group '${name}'`), null);

  delete _groups[name];

  if (distribution && name in distribution && name !== "all" && name !== "local"){
    try { delete distribution[name]; } catch (_) {}
  }
  return callback(null, g);
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  callback = callback || (() => {});
  const distribution = globalThis.distribution;

  if (typeof name !== "string") {
    return callback(new Error("groups.add name must be a string"));
  }

  const g = _groups[name];
  if (!g) return callback(new Error(`groups.add unknown group '${name}'`),null);

  if(!node || typeof node.ip !== "string" || typeof node.port === "undefined") {
    return callback(new Error("groups.add invalid node"), null);
  }

  const id = distribution?.util?.id;
  const sid = 
  (id && typeof id.getSID === "function" && id.getSID(node)) ||
  (id && typeof id.getNID === "function" && id.getNID(node)) ||
  `${node.ip}:${node.port}`;

  g[sid] = { ip: node.ip, port: node.port};

  if (!_groups.all) _groups.all = Object.create(null);
  _groups.all[sid] = g[sid];

  return callback(null, Object.assign({},g));
};

/**
 * @param {string} name
 * @param {string} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  callback = callback || (() => {});


  if (typeof name !== "string") {
    return callback(new Error("groups.rem: name must be a string"), null);
  }
  if (typeof node !== "string") {
    return callback(new Error("groups.rem: node must be a string (SID)"), null);
  }

  const g = _groups[name];
  if (!g) return callback(new Error(`groups.rem: unknown group '${name}'`), null);
  if (!(node in g)) return callback(new Error(`groups.rem: unknown node '${node}'`), null);

  delete g[node];

  return callback(null, Object.assign({}, g));
};

module.exports = {get, put, del, add, rem};
