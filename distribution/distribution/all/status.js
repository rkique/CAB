// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Status
 * @property {(configuration: string, callback: Callback) => void} get
 * @property {(configuration: Node, callback: Callback) => void} spawn
 * @property {(callback: Callback) => void} stop
 */

/**
 * @param {Config} config
 * @returns {Status}
 */
function status(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    // call distribution.gid.comm.send  with configuration
    let send = distribution[context.gid].comm.send;
    let msg = [configuration];
    let remote = { service: 'status', method: 'get' }
    // handle heapTotal, heapUsed, and counts cases by wrapping callback
    send(msg, remote, (e, v) => {
      if (configuration == 'heapTotal' || configuration == 'heapUsed') {
        const total = Object.values(v).reduce((sum, val) => sum + val, 0);
        return callback(e, total)
      }
      if (configuration === 'counts') {
        const total = Object.values(v).reduce((sum, val) => sum + val, 0);
        return callback(e, total);
      }
      return callback(e, v);
    })
  }

  /**
   * @param {Node} configuration
   * @param {Callback} callback
   */
  function spawn(configuration, callback) {
    callback(new Error('status.spawn not implemented')); // If you won't implement this, check the skip.sh script.
  }

  /**
   * @param {Callback} callback
   */
  function stop(callback) {
    callback(new Error('status.stop not implemented')); // If you won't implement this, check the skip.sh script.
  }

  return { get, stop, spawn };
}

module.exports = status;
