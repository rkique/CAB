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
  function put(service, name, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if(!comm || typeof comm.send !== 'function') {
      return callback(new Error(`routes.put: missing comm for gid=${context.gid}`), null);
    }
    
    comm.send([service, name], { service: 'routes', method: 'put', gid: 'local'}, (e, v) => {
      callback(e, v);
    });
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function rem(configuration, callback) {
    callback = callback || (() => {});
    const distribution = globalThis.distribution;

    const comm = distribution?.[context.gid]?.comm;
    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error(`routes.rem: missing comm for gid=${context.gid}`), null);
    }
    comm.send([configuration], { service: 'routes' , method: 'rem', gid: 'local' },(e,v) => {
      callback(e,v);
    });
  }

  return {put, rem};
}

module.exports = routes;
