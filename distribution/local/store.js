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

- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function normalizeConfig(configuration) {
  if (configuration == null) return { key: null, gid: 'local' };
  if (typeof configuration === 'string') return { key: configuration, gid: 'local' };
  return { key: configuration.key ?? null, gid: configuration.gid ?? 'local' };
}

function sha256String(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function safeName(s) {
  // spec says "convert to alphanumeric-only"
  const out = String(s).replace(/[^a-zA-Z0-9]/g, '');
  // if it becomes empty, fall back to a hash so filename is still valid
  return out.length > 0 ? out : sha256String(String(s));
}

function nodeNID() {
  // In this project, distribution should know its node config
  const util = globalThis.distribution.util;
  const node = globalThis.distribution.node?.config; // most common
  if (!node || typeof node.ip !== 'string' || typeof node.port !== 'number') {
    throw new Error('store: cannot determine local node (missing distribution.node.config)');
  }
  return util.id.getNID(node);
}

function baseDir() {
  // local/store.js lives at <root>/distribution/local/store.js
  const projectRoot = path.resolve(__dirname, '..', '..');
  return path.join(projectRoot, 'store', nodeNID());
}

function filePathFor(gid, key) {
  return path.join(baseDir(), safeName(gid), safeName(key));
}

function ensureDir(dir, cb) {
  fs.mkdir(dir, { recursive: true }, cb);
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  const util = globalThis.distribution.util;
  const { key, gid } = normalizeConfig(configuration);

  const finalKey = key ?? util.id.getID(state);

  const fp = filePathFor(gid, finalKey);

  ensureDir(path.dirname(fp), (e) => {
    if (e) return callback(new Error(e.message));
    fs.writeFile(fp, util.serialize(state), 'utf8', (err) => {
      if (err) return callback(new Error(err.message));
      return callback(null, state);
    });
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const util = globalThis.distribution.util;
  const { key, gid } = normalizeConfig(configuration);
  if (key == null) return callback(new Error('store.get: key is required'));

  const fp = filePathFor(gid, key);
  fs.readFile(fp, 'utf8', (e, text) => {
    if (e) return callback(new Error(e.message));
    try {
      return callback(null, util.deserialize(text));
    } catch (err) {
      return callback(err);
    }
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  const util = globalThis.distribution.util;
  const { key, gid } = normalizeConfig(configuration);
  if (key == null) return callback(new Error('store.del: key is required'));

  const fp = filePathFor(gid, key);

  fs.readFile(fp, 'utf8', (readErr, text) => {
    if (readErr) return callback(new Error(readErr.message));

    let obj;
    try {
      obj = util.deserialize(text);
    } catch (err) {
      return callback(err);
    }

    fs.unlink(fp, (unlinkErr) => {
      if (unlinkErr) return callback(new Error(unlinkErr.message));
      return callback(null, obj);
    });
  });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  const util = globalThis.distribution.util;
  const {key, gid} = normalizeConfig(configuration);

  const finalKey = key ?? util.id.getID(state);
  const fp = filePathFor(gid, finalKey);

  ensureDir(path.dirname(fp), (mkdirErr) => {
    if (mkdirErr) return callback(new Error(mkdirErr.message));

    fs.readFile(fp, 'utf8', (readErr, text) => {
      let arr = [];

      if(!readErr) {
        try{
          const existing = util.deserialize(text);
          if (Array.isArray(existing)) arr = existing;
          else arr = [existing];
        } catch (err) {
          return callback(err);
        }
      } else if (readErr.code !== 'ENOENT') {
        return callback(new Error(readErr.message));
      }

      arr.push(state);

      fs.writeFile(fp, util.serialize(arr), 'utf8', (writeErr) => {
        if (writeErr) return callback(new Error(writeErr.message));
        return callback(null, arr)
      });
    });
  });
}

module.exports = {put, get, del, append};
