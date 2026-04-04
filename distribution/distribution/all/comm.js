// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    //console.log(`[all.comm.send] message: ${JSON.stringify(message)}, configuration: ${JSON.stringify(configuration)}`);
    //send will get the nodes in the local context
    distribution.local.groups.get(context.gid, (e, nodes) => {
      if (e) {
        return callback(e);
      }
      const nodeIds = Object.keys(nodes);
      if (nodeIds.length === 0) {
        return callback(new Error('No nodes in group'));
      }

      let responsesReceived = 0;
      const responses = {};
      const errors = {};
      nodeIds.forEach((nodeId) => {
        const node = nodes[nodeId];
        const remoteConfig = {
          service: configuration.service,
          method: configuration.method,
          node: node
        };
        distribution.local.comm.send(message, remoteConfig, (err, val) => {
          responsesReceived++;
          if (err) {
            errors[nodeId] = err;
          } else {
            responses[nodeId] = val;
          }
          if (responsesReceived === nodeIds.length) {
            const finalError = Object.keys(errors).length > 0 ? errors : null;
            return callback(finalError, responses);
          }
        });
      });
    });
  }

  return { send };
}

module.exports = comm;
