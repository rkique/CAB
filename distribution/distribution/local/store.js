// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

/* Notes/Tips:
- Store should also implement a unique gid path
- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/
const path = require('path');
const fs = require('fs');
const util = require('../util/util.js');

function getNodeStoreDir() {
  const nodeConfig = globalThis.distribution?.node?.config;
  const scope = nodeConfig ? util.id.getSID(nodeConfig) : 'orchestrator';
  return path.resolve(__dirname, 'store', scope);
}

// Keep lightweight metadata about which distributed service context wrote each key.
const keyOrigins = new Map();

function rememberKeyOrigin(configuration, normalizedKey) {
  if (!normalizedKey) {
    return;
  }
  const origin = (typeof configuration === 'object' && configuration)
    ? (configuration.origin || configuration.gid || 'local')
    : 'local';
  const existing = keyOrigins.get(normalizedKey);
  if (existing) {
    existing.add(origin);
    return;
  }
  keyOrigins.set(normalizedKey, new Set([origin]));
}

function getManifestKey(gid) {
  return `__manifest__.${gid || 'local'}`;
}

/**
 * Canonicalize key material to a lowercase hex filename-safe token.
 * This avoids collisions on case-insensitive filesystems.
 * @param {any} key
 * @returns {string}
 */
function canonicalizeKey(key) {
  return util.id.getID({ key: String(key) });
}

/**
 * @param {SimpleConfig} configuration
 * @returns {string | null}
 */
function normalizeConfig(configuration, state) {

  if (configuration == null) {
    return util.id.getID(state);
  }
  //use standard format
  if (typeof configuration === 'object') {
    if (configuration.key == null) {
      return getManifestKey(configuration.gid);
    }
    // if (!configuration.key || !configuration.gid) {
    //   console.log(`[store.normalizeConfig] warning: configuration object ${JSON.stringify(configuration)} missing key or gid`);
    // }
    // Object configs may already carry a hashed key from all/store.
    // Do not hash again here to avoid H(H(key)) mismatches.
    return `${canonicalizeKey(configuration.key)}.${configuration.gid}`;
  }
  return configuration;
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  if (state == null) {
    return callback(new Error('state cannot be null'));
  }
  let serializedState = util.serialize(state);
  let key = normalizeConfig(configuration, state);
  rememberKeyOrigin(configuration, key);
  // console.log(`[store.put] normalized key: ${key} for configuration: ${JSON.stringify(configuration)}`)
  const filePath = path.resolve(getNodeStoreDir(), String(key));
  //make sure the store directory exists
  fs.mkdir(path.dirname(filePath), { recursive: true }, (err) => {
    if (err) {
      return callback(err);
    }
    fs.writeFile(filePath, serializedState, (err) => {
      if (err) return callback(err);
      return callback(null, state);
    });
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  if (configuration && typeof configuration === 'object' && configuration.key == null) {
    const manifestKey = normalizeConfig(configuration);
    const manifestPath = path.resolve(getNodeStoreDir(), manifestKey);
    fs.readFile(manifestPath, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') return callback(null, []);
        return callback(new Error(err.message));
      }
      try {
        const keys = util.deserialize(data);
        return callback(null, Array.isArray(keys) ? [...new Set(keys)] : []);
      } catch (e) {
        return callback(e);
      }
    });
    return;
  }

  if (configuration == null) {
    return callback(null, []);
  }
  const key = normalizeConfig(configuration);
  if (key == null) {
    return callback(new Error('store.get key cannot be null'));
  }
  
  const filePath = path.resolve(getNodeStoreDir(), key);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return callback(new Error(err.message));
    }
    try {
      callback(null, util.deserialize(data));
    } catch (e) {
      callback(e);
    }
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const key = normalizeConfig(configuration);
  if (key == null) {
    return callback(new Error('store.del key cannot be null'));
  }
  const filePath = path.resolve(getNodeStoreDir(), key);
  fs.readFile(filePath, 'utf8', (readErr, data) => {
    if (readErr) {
      return callback(new Error(readErr.message));
    }
    let value;
    try {
      value = util.deserialize(data);
    } catch (e) {
      return callback(e);
    }
    //given the value, proceed to unlink path and return value
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        return callback(new Error(unlinkErr.message));
      }
      keyOrigins.delete(key);
      return callback(null, value);
    });
  });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  if (configuration == null) {
    return callback(new Error('store.append configuration cannot be null'));
  }
  const key = normalizeConfig(configuration, state);
  rememberKeyOrigin(configuration, key);
  if (key == null) {
    return callback(new Error('store.append key cannot be null'));
  }

  const filePath = path.resolve(getNodeStoreDir(), String(key));
  fs.mkdir(path.dirname(filePath), { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      return callback(mkdirErr);
    }
    try {
      let current = [];
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        const deserialized = util.deserialize(data);
        current = Array.isArray(deserialized) ? deserialized : [deserialized];
      } catch (readErr) {
        if (readErr && readErr.code !== 'ENOENT') {
          return callback(new Error(`[store.append]: ${readErr.message}`));
        }
      }

      current.push(state);
      // console.log(`[store.append] appending value to key ${key}, now has value ${JSON.stringify(current)}`);
      fs.writeFileSync(filePath, util.serialize(current));
      return callback(null, current);
    } catch (writeErr) {
      return callback(new Error(`[store.append]: ${writeErr.message}`));
    }
  });
}

module.exports = { put, get, del, append };