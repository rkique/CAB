// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('node:http');

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} [gid]
 */

/**
 * @param {Array<any>} message
 * @param {Target} remote
 * @param {(error: Error, value?: any) => void} callback
 * @returns {void}
 */
function send(message, remote, callback) {
  const serialize = globalThis.distribution.util.serialize;
  const deserialize = globalThis.distribution.util.deserialize;

  callback = callback || function () {};

  // Validate message
  if (!Array.isArray(message)) {
    return callback(new Error('Message must be an array'), null);
  }

  if (!remote || !remote.node) {
    return callback(new Error('Missing remote node'), null);
  }

  const { ip, port } = remote.node;

  if (!ip) {
    return callback(new Error('Missing node IP'), null);
  }

  if (!port) {
    return callback(new Error('Missing node port'), null);
  }

  if (!remote.service || !remote.method) {
    return callback(new Error('Missing service or method'), null);
  }

  const gid = remote.gid || 'local';

  const options = {
    hostname: ip,
    port: port,
    path: `/${gid}/${remote.service}/${remote.method}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {

    let body = '';

    res.on('data', chunk => {
      body += chunk;
    });

    res.on('end', () => {
      try {
        const [err, value] = deserialize(body);
        callback(err, value);
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on('error', (err) => {
    callback(err, null);
  });

  try {
    req.write(serialize(message));
    req.end();
  } catch (e) {
    callback(e, null);
  }
}

module.exports = {send};
