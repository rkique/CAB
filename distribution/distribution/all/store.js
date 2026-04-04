// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Hasher} Hasher
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
    hash: config.hash || globalThis.distribution.util.id.consistentHash,
    subset: config.subset,
  };

  function normalizeConfig(configuration, state, is_get=false){
    let kid;
    if (configuration == null) {
      if (is_get) {
        // Null get is handled explicitly by get(); do not hash undefined.
        return { key: null, gid: context.gid };
      }
      kid = distribution.util.id.getID(state);
      return {key: kid, gid: context.gid};
    } else {
      if (typeof configuration === 'string') {
        // Only treat full SHA-256 hex strings as pre-hashed keys.
        if (/^[0-9a-fA-F]{64}$/.test(configuration)) {
          return {key: configuration, gid: context.gid};
        }
        kid = distribution.util.id.getID(configuration);
        if (is_get){ return {key: kid, gid: context.gid}; }
        return { key: kid, gid: context.gid };
      } else {
        kid = distribution.util.id.getID(configuration.key);
        if (is_get){ return {key: configuration.key, gid: context.gid}; }
        return { key: kid, gid: context.gid };
      }
    }
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    if (configuration == null) {
      // Return all user keys known for this gid from per-node manifests.
      return distribution.local.groups.get(context.gid, (e, nodes) => {
        if (e) return callback(e);
        const nodeIds = Object.keys(nodes);
        if (nodeIds.length === 0) return callback(null, []);

        let pending = nodeIds.length;
        const merged = [];
        let failed = false;

        nodeIds.forEach((nodeId) => {
          const node = nodes[nodeId];
          const remote = { node, service: 'store', method: 'get' };
          distribution.local.comm.send([{ gid: context.gid }], remote, (err, keys) => {
            if (failed) return;
            if (err) {
              // Missing manifest on a node means that node has no keys yet.
              if (typeof err.message === 'string' && err.message.includes('ENOENT')) {
                pending--;
                if (pending === 0) callback(null, [...new Set(merged)]);
                return;
              }
              failed = true;
              return callback(err);
            }
            //potentially the object which is { node, service: 'store', method: 'get' };
            //should contain relevant keys

            if (Array.isArray(keys)) {
              merged.push(...keys);
            }

            pending--;
            if (pending === 0) {
              callback(null, [...new Set(merged)]);
            }
          });
        });
      });
    }

    configuration = normalizeConfig(configuration, undefined, true);
    // console.log(`[all.store.get] configuration set as ${JSON.stringify(configuration)}`)
    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(configuration.key, nids);
      const node = nodes[nodeID];

      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }
      //use remote store call
      let remote = { node: node, service: 'store', method: 'get' };
      distribution.local.comm.send([configuration], remote, callback);
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {
    const rawKey = typeof configuration === 'string' ? configuration : configuration?.key;
    configuration = normalizeConfig(configuration, state);
    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(configuration.key, nids);
      const node = nodes[nodeID];

      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }
      let remote = { node: node, service: 'store', method: 'put' };
      let message = [state, configuration];
      //send the put request
      return distribution.local.comm.send(message, remote, (putErr, putVal) => {
        if (putErr) return callback(putErr);

        if (rawKey == null) {
          return callback(null, putVal);
        }

        // Track original keys for get(null) manifest lookup.
        const remoteAppend = { node: node, service: 'store', method: 'append' };
        //remoteAppend to the send call.
        distribution.local.comm.send([rawKey, { gid: context.gid }], remoteAppend, (appendErr) => {
          if (appendErr) return callback(appendErr);
          return callback(null, putVal);
        });
      });
    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  //1. hashes configuration and selects appropriate node
  //2. remotely executes get and put on that node to append to the appropriate store.
  // gid = target nodes, store_gid = what gid to store under on these nodes. from config.
  function append(state, configuration, callback) {
    if (configuration == null) {
      return callback(new Error('append requires config'))
    }

    configuration = normalizeConfig(configuration, state);
    distribution.local.groups.get(context.gid, (e, nodes) => {
      if (e) return callback(e);

      const nids = Object.keys(nodes);
      const nodeID = context.hash(configuration.key, nids);
      const node = nodes[nodeID];
      if (!node) {
        return callback(new Error(`[append] Node ${nodeID} not found in group`))
      }
      const remoteGet = {node: node, service: 'store', method: 'get'};
      const remotePut = {node: node, service: 'store', method: 'put'};
      distribution.local.comm.send([configuration], remoteGet, (getErr, current) => {
        if (getErr) { return callback(new Error(`[put-in-append] node not found`))}
        const next = [...current, state];
        distribution.local.comm.send(
          [next, configuration],
          remotePut,
          (putErr, putVal) => callback(putErr, putVal),
        );
      });
    })
    }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    configuration = normalizeConfig(configuration);
    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(configuration.key, nids);
      const node = nodes[nodeID];

      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }
      //use remote store call
      let remote = { node: node, service: 'store', method: 'del' };
      distribution.local.comm.send([configuration], remote, callback);
    }); 
  }
  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('store.reconf not implemented'));
  }

  /* For the distributed store service, the configuration will
          always be a string */
  return { get, put, append, del, reconf };
}

module.exports = store;