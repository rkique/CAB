/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */

const local = require("./local");

const services = new Map()

/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function get(configuration, callback) {
  if (configuration === null){
    return callback(new Error('configuration cannot be null'));
  }
  // Handle case where configuration is not passed (args shift)
  if (typeof configuration === 'function') {
    callback = configuration;
    configuration = undefined;
  }
  //export routes as dependency
  if (configuration === 'routes' || !configuration) {
    return callback(null, module.exports);
  }
  if (configuration == 'status'){
    return callback(null, require('./status'));
  }
  //handle configuration as {service: ..., gid: 'local'}
  if (typeof configuration == 'object' && configuration.service){
    let serviceName = configuration.service
    let gid = configuration.gid
    //if gid is local, track service on local
    if (gid == 'local'){
      if (services.has(serviceName)) {
        return callback(null, services.get(serviceName))
      } else {
        return callback(new Error('service not found'));
      }
    }
  } 
  if (services.has(configuration)) {
    return callback(null, services.get(configuration))
  } else {
    return callback(new Error('service not found'));
  }
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  console.log(`[all.routes.put] service: ${JSON.stringify(service)}, configuration: ${configuration}`);
  services.set(configuration, service)
  callback(null, service);
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  const service = services.get(configuration)
  services.delete(configuration)
  //get the service that was just deleted and return it in the callback
  callback(null, service)
}

module.exports = {get, put, rem};
