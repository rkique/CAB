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
 */

/**
 * @param {Config} config
 */
function store(config) {
  const context = {
    gid: config.gid || 'all',
    hash: config.hash || globalThis.distribution.util.id.naiveHash,
    subset: config.subset,
  };

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
    if (context.subset) {
      const nodes = Array.isArray(context.subset) ?
        context.subset :
        Object.values(context.subset);
      return cb(null, nodes);
    }

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
        return cb(new Error(`store: group "${context.gid}" is empty`));
      }

      const kid = util.id.getID(primaryKey);
      const nids = nodes.map((n) => util.id.getNID(n));
      const chosenNid = context.hash(kid, nids);

      const chosenNode = nodes.find((n) => util.id.getNID(n) === chosenNid);
      if (!chosenNode) return cb(new Error('store: hash chose unknown node'));

      return cb(null, chosenNode);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    const cfg = normalizeConfig(configuration);

    if (cfg.key === null) {
      return getNodes((e, nodes) => {
        if (e) return callback(e);
        if (!nodes || nodes.length === 0) return callback(null, []);

        const results = [];
        let pending = nodes.length;
        let done = false;

        const finish = (err, value) => {
          if (done) return;
          done = true;
          callback(err, value);
        };

        nodes.forEach((node) => {
          const remote = {node, service: 'store', method: 'get'};
          const localCfg = {key: null, gid: cfg.gid};

          globalThis.distribution.local.comm.send([localCfg], remote, (err, value) => {
            if (done) return;
            if (err) return finish(err);

            if (Array.isArray(value)) {
              results.push(...value);
            } else if (value !== undefined && value !== null) {
              results.push(value);
            }

            pending -= 1;
            if (pending === 0) {
              finish(null, results);
            }
          });
        });
      });
    }

    pickNode(cfg.key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'store', method: 'get'};
      const localCfg = {key: cfg.key, gid: cfg.gid};
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

      const remote = {node, service: 'store', method: 'put'};
      const localCfg = {key, gid: cfg.gid};
      return globalThis.distribution.local.comm.send([state, localCfg], remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    const util = globalThis.distribution.util;
    const cfg = normalizeConfig(configuration);

    const key = cfg.key ?? util.id.getID(state);

    pickNode(key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'store', method: 'append'};
      const localCfg = {key, gid: cfg.gid};
      return globalThis.distribution.local.comm.send([state, localCfg], remote, callback);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    const cfg = normalizeConfig(configuration);
    if (cfg.key === null) return callback(new Error('store.del: key is required'));

    pickNode(cfg.key, (e, node) => {
      if (e) return callback(e);

      const remote = {node, service: 'store', method: 'del'};
      const localCfg = {key: cfg.key, gid: cfg.gid};
      return globalThis.distribution.local.comm.send([localCfg], remote, callback);
    });
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('store.reconf not implemented'));
  }

  return {get, put, append, del, reconf};
}

  /* For the distributed store service, the configuration will
          always be a string */

module.exports = store;