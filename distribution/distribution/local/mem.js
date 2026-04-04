// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string | null} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */


const util = require('../util/util.js');
const { config } = require("./node.js");

/**
 * @param {SimpleConfig} configuration
 * @returns {string | null}
 */
function normalizeConfig(configuration, state) {

  if (configuration == null && state) {
    return util.id.getID(state);
  }

  //use standard format
  if (typeof configuration === 'object') {
    if (!configuration.key || !configuration.gid) {
      console.log(`[store.normalizeConfig] warning: configuration object ${JSON.stringify(configuration)} missing key or gid`);
    }
    return `${configuration.key}.${configuration.gid}`
  }
  return String(configuration);
}

//mem is a store for the local node
let mem = {};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  let key = normalizeConfig(configuration, state);
  // console.log(`[mem.put] putting value with key ${key}`);
  if (state == null){
    return callback(new Error('state cannot be null'));
  }
  //console.log(`[mem.put] putting value with key ${key} and state ${state} in mem`);
  mem[key] = state;
  callback(null, state);
};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
};

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration == null) {
    return callback(new Error('mem.get configuration cannot be null'));
  }
  let key = normalizeConfig(configuration);
  if (mem[key] == null) {
    return callback(new Error(`mem.get for ${JSON.stringify(configuration)} not found`));
  }
  callback(null, mem[key]);
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  let key = normalizeConfig(configuration);
  if (mem[key] == null) {
    return callback(new Error(`mem.del for ${JSON.stringify(configuration)} not found`));
  }
  const state = mem[key];
  delete mem[key];
  callback(null, state);
};

module.exports = {put, get, del, append};
