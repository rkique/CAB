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

const { normalize } = require("yargs");

const data = new Map ();


function normalizeConfig(configuration) {
  if (configuration === null || configuration === undefined) {
    return {key: null, gid: 'local'};
  }
  if (typeof configuration === 'string') {
    return {key: configuration, gid: 'local'};
  }
  return {
    key: configuration.key ?? null,
    gid: configuration.gid ?? 'local',
  };
}

function ns(gid) {
  if (!data.has(gid)) data.set(gid, new Map());
  return data.get(gid);
}


/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const util = globalThis.distribution.util;
  const {key, gid} = normalizeConfig(configuration);

  const finalKey = key ?? util.id.getID(state);
  ns(gid).set(finalKey, state);

  return callback(null, state);
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
  const {key, gid} = normalizeConfig(configuration);
  if (key === null) {
    return callback(new Error('mem.get: key is required'));
  }

  const m = ns(gid);
  if (!m.has(key)) {
    return callback(new Error(`mem.get: missing key="${key}" gid="${gid}"`));
  }
  return callback(null, m.get(key));
}


/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const {key, gid} = normalizeConfig(configuration);
  if (key === null) {
    return callback(new Error('mem.del: key is required'));
  }

  const m = ns(gid);
  if (!m.has(key)) {
    return callback(new Error(`mem.del: missing key="${key}" gid="${gid}"`));
  }

  const v = m.get(key);
  m.delete(key);
  return callback(null, v);
};

module.exports = {put, get, del, append};
