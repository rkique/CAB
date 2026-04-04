// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 *
 * @typedef {Object} Routes
 * @property {(service: object, name: string, callback: Callback) => void} put
 * @property {(configuration: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Routes}
 */
function routes(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {object} service
   * @param {string} name
   * @param {Callback} callback
   */
  //put a service on each local name
  function put(service, name, callback) {
    let send = distribution[context.gid].comm.send;
    let msg = [service, name];
    let remote = {service: 'routes', method: 'put'}
    send(msg, remote, callback);
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  //put a service on each local name.
  function rem(configuration, callback) {
    let send = distribution[context.gid].comm.send;
    let msg = [configuration];
    let remote = {service: 'routes', method: 'rem'}
    send(msg, remote, callback);
  }

  return {put, rem};
}

module.exports = routes;
