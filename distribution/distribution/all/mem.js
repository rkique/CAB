// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const util = require("../util/util.js");


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
  function get(configuration, callback) {

    if (typeof configuration == "string"){
      configuration = { key: configuration, gid: context.gid };
    }

    const kid = distribution.util.id.getID(configuration.key);

    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(kid, nids);
      const node = nodes[nodeID];
      
      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }

      let remote = { node: node, service: 'mem', method: 'get' };
      distribution.local.comm.send([configuration], remote, callback);

    });
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {

    if (configuration == null) {
      configuration = util.id.getID(state);
    }

    if (typeof configuration == "string"){
      configuration = { key: configuration, gid: context.gid };
    }

    const kid = distribution.util.id.getID(configuration.key);
    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(kid, nids);
      const node = nodes[nodeID];

      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }

      let remote = { node: node, service: 'mem', method: 'put' };
      let message = [state, configuration];
      return distribution.local.comm.send(message, remote, callback);
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    if (typeof configuration == "string"){
      configuration = { key: configuration, gid: context.gid };
      console.log(`[del] setting config to ${JSON.stringify(configuration)}`)
    }

    let kid = distribution.util.id.getID(configuration.key);
    distribution.local.groups.get(context.gid, (e, nodes) => {

      if (e) return callback(e);
      const nids = Object.keys(nodes);
      const nodeID = context.hash(kid, nids);
      const node = nodes[nodeID];

      if (!node) {
        return callback(new Error(`Node ${nodeID} not found in group ${context.gid}`));
      }

      let remote = { node: node, service: 'mem', method: 'del' };
      distribution.local.comm.send([configuration], remote, callback);
    });
  }

//use local.comm.send to invoke corresponding mem
/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
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
