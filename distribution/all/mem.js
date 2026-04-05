// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(configuration: Object.<string, Node>, callback: Callback) => void} reconf
 */


/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || globalThis.distribution.util.id.naiveHash;

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */

  function normalizeConfig(configuration) {
    if (configuration === null || configuration === undefined) {
      return {key: null, gid: context.gid};
    }
    if (typeof configuration === 'string') {
      return {key: configuration, gid: context.gid};
    }
    return {
      key: configuration.key ?? null,
      gid: configuration.gid ?? context.gid,
    };
  }

  function getNodes(cb) {
    const groups = globalThis.distribution.local.groups;
    groups.get(context.gid, (e, group) => {
      if (e) return cb(e);
      const nodes = Object.values(group || {});
      return cb(null, nodes);
    });
  }

  function pickNode(primaryKey, cb) {
    const util = globalThis.distribution.util;

    getNodes((e, nodes) => {
      if (e) return cb(e);
      if (!nodes || nodes.length === 0) {
        return cb(new Error(`mem: group "${context.gid}" is empty`));
      }
      const kid = util.id.getID(primaryKey);

      const nids = nodes.map((n) => util.id.getNID(n));
      const chosenNid = context.hash(kid, nids);

      const chosenNode = nodes.find((n) => util.id.getNID(n) === chosenNid);
      if (!chosenNode) return cb(new Error('mem: hash chose unknown node'));

      return cb(null, chosenNode);
    });
  }


  function get(configuration, callback) {
    const {key} = normalizeConfig(configuration);
    if (key === null) return callback(new Error('mem.get: key is required'));

    pickNode(key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'mem', method: 'get'};
      const localCfg = {key, gid: context.gid}; 
      return globalThis.distribution.local.comm.send([localCfg], remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    const util = globalThis.distribution.util;
    const cfg = normalizeConfig(configuration);

    const key = cfg.key ?? util.id.getID(state);

    pickNode(key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'mem', method: 'put'};
      const localCfg = {key, gid: context.gid};
      return globalThis.distribution.local.comm.send([state, localCfg], remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    const {key} = normalizeConfig(configuration);
    if (key === null) return callback(new Error('mem.del: key is required'));

    pickNode(key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'mem', method: 'del'};
      const localCfg = {key, gid: context.gid};
      return globalThis.distribution.local.comm.send([localCfg], remote, callback);
    });
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('mem.reconf not implemented'));
  }
  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;
