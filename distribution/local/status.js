// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

/**
 * @param {string} configuration
 * @param {Callback} callback
 */

const distribution = globalThis.distribution;

function get(configuration, callback) {
  if (!callback) callback = () => {};

  const node = globalThis.distribution.node;
  const config = node.config;
  const id = globalThis.distribution.util.id;

  switch (configuration) {
    case 'nid':
      return callback(null, id.getNID(config));

    case 'sid':
      return callback(null, id.getSID(config));

    case 'ip':
      return callback(null, config.ip);

    case 'port':
      return callback(null, config.port);

    case 'counts':
      return callback(null, node.counts ?? 0);

    case 'heapTotal':
      return callback(null, process.memoryUsage().heapTotal);

    case 'heapUsed':
      return callback(null, process.memoryUsage().heapUsed);

    default:
      return callback(new Error('Invalid status key'));
  }
}


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  callback(new Error('status.spawn not implemented'));
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(new Error('status.stop not implemented'));
}

module.exports = {get, spawn, stop};
