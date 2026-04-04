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
  //add default callback to avoid unhandled errors
  callback = callback || function() {};
  if (!remote.node || !remote.node.ip || !remote.node.port) {
    return callback(new Error(`Invalid remote node configuration: ${JSON.stringify(remote.node)}`), null);
  }
  if (!remote.service || !remote.method) {
    return callback(new Error(`Invalid remote target configuration: ${JSON.stringify(remote)}`), null);
  }
  if (!Array.isArray(message)) {
    message = [message];
  }
  console.log(`[comm.local.send] message is ${JSON.stringify(message)}`)
  const options = {
    method: 'PUT',
    hostname: remote.node.ip,
    port: remote.node.port,
    path: `/${remote.gid || 'local'}/${remote.service}/${remote.method}`,
    headers: {'Content-Type': 'application/json'}
  };
  const req = http.request(options, (res) => {
    let data = []; 
    res.on('data', (chunk) => { data.push(chunk); });
    
    res.on('end', () => {
      globalThis.distribution.node.counts++;
      try {
        const buffer = Buffer.concat(data);
        const result = globalThis.distribution.util.deserialize(buffer.toString());
        if (Array.isArray(result) && result.length === 2) {
          return callback(result[0], result[1]);
        }
        callback(null, result);
      } catch (error) {
        callback(error);
      }
    });
  });
  
  req.on('error', (error) => {
    console.log(`[comm.send] error: ${error}`);
    callback(error);});

  req.write(globalThis.distribution.util.serialize(message))
  req.end()
}


module.exports = {send};
