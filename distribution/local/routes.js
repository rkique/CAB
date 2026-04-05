/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */


/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function get(configuration, callback) {
  if (!callback) {
    callback = () => {};
  }

  const distribution = globalThis.distribution;

  const name = 
  typeof configuration === 'string'
    ? configuration
    : configuration.service;

  const gid = 
    typeof configuration === "string"
    ? 'local'
    : (configuration.gid || 'local');

  const table = 
    gid === "local"
      ? distribution.local
      : distribution[gid];
  if (!table) {
    return callback(new Error(`Group not found: ${gid}`));
  }

  if (!table[name]) {
    return callback(new Error(`Service not found ${name} (gid=${gid})`));
  }

  return callback(null, table[name]);
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  if (!callback) {
    callback = () => {};
  }
  const routes = /** @type {any} */ (globalThis.distribution.local);
  const name = configuration;

  routes[name] = service;

  return callback(null,name);
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  if (!callback) callback = () => {};

  const routes = globalThis.distribution.local;
  const name = configuration;

  if (!routes[name]) {
    return callback(new Error(`Service not found: ${name}`));
  }

  const removed = routes[name];
  delete routes[name];

  return callback(null, removed);
}

module.exports = {get, put, rem};
