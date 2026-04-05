// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Groups
 * @property {(config: Config | string, group: Object.<string, Node>, callback: Callback) => void} put
 * @property {(name: string, callback: Callback) => void} del
 * @property {(name: string, callback: Callback) => void} get
 * @property {(name: string, node: Node, callback: Callback) => void} add
 * @property {(name: string, node: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Groups}
 */
function groups(config) {
  const context = {gid: config.gid || 'all'};

  /**
   * @param {Config | string} config
   * @param {Object.<string, Node>} group
   * @param {Callback} callback
   */
  function put(config, group, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`groups.put: missing comm for gid=${context.gid}`),null);
    }

    comm.send([config, group], {service: 'groups', method: 'put', gid: 'local' }, (e,v) => {
      callback(e,v);
    })
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function del(name, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`groups.del missing comm for gid=${context.gid}`),null);
    }

    comm.send([name], {service : 'groups', method: 'del', gid: 'local'}, (e,v) => {
      callback(e,v);
    });
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function get(name, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`groups.get: missing comm for gid=${context.gid}`),null);   
    }

    comm.send([name], { service: 'groups', method: 'get', gid: 'local' }, (e,v) => {
      callback(e,v);
    });
  }

  /**
   * @param {string} name
   * @param {Node} node
   * @param {Callback} callback
   */
  function add(name, node, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`groups.add: missing comm for gid=${context.gid}`), null);
    }

    comm.send([name, node], { service: 'groups', method: 'add', gid: 'local' }, (e,v) => {
      callback(e,v);
    });
  }

  /**
   * @param {string} name
   * @param {string} node
   * @param {Callback} callback
   */
  function rem(name, node, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`groups.rem: missing comm for gid=${context.gid}`), null);
    }
    comm.send([name, node], { service: 'groups', method: 'rem', gid: 'local' }, (e, v) => {
      callback(e,v);
    });
  }

  return {
    put, del, get, add, rem,
  };
}

module.exports = groups;
