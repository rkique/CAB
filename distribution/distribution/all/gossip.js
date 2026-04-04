// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Node} Node
 *
 * @typedef {Object} Remote
 * @property {Node} node
 * @property {string} service
 * @property {string} method

 * @typedef {Object} Payload
 * @property {Remote} remote
 * @property {any} message
 * @property {string} mid
 * @property {string} gid
 *
 *
 * @typedef {Object} Gossip
 * @property {(payload: Payload, remote: Remote, callback: Callback) => void} send
 * @property {(perod: number, func: () => void, callback: Callback) => void} at
 * @property {(intervalID: NodeJS.Timeout, callback: Callback) => void} del
 */


/**
 * @param {Config} config
 * @returns {Gossip}
 */
function gossip(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.subset = config.subset || function(lst) {
    return Math.ceil(Math.log(lst.length));
  };

  /**
   * @param {Payload} payload
   * @param {Remote} remote
   * @param {Callback} callback
   */
  function send(payload, remote, callback) {
    return callback(new Error('gossip.send not implemented'));
  }

  /**
   * @param {number} period
   * @param {() => void} func
   * @param {Callback} callback
   */
  function at(period, func, callback) {
    return callback(new Error('gossip.at not implemented'));
  }

  /**
   * @param {NodeJS.Timeout} intervalID
   * @param {Callback} callback
   */
  function del(intervalID, callback) {
    return callback(new Error('gossip.del not implemented'));
  }

  return {send, at, del};
}

module.exports = gossip;
