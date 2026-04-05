// @ts-check
/**
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Callback} Callback
 */
const http = require('node:http');
const url = require('node:url');
const log = require('../util/log.js');

const yargs = require('yargs/yargs');
const { rmSync } = require("node:fs");
const { parse } = require("yargs");

/**
 * @returns {Node}
 */
function setNodeConfig() {
  const args = yargs(process.argv)
      .help(false)
      .version(false)
      .parse();

  let maybeIp; let maybePort; let maybeOnStart;
  if (typeof args.ip === 'string') {
    maybeIp = args.ip;
  }
  if (typeof args.port === 'string' || typeof args.port === 'number') {
    maybePort = parseInt(String(args.port), 10);
  }

  if (args.help === true || args.h === true) {
    console.log('Node usage:');
    console.log('  --ip <ip address>      The ip address to bind the node to');
    console.log('  --port <port>          The port to bind the node to');
    console.log('  --config <config>      The serialized config string');
    process.exit(0);
  }

  if (typeof args.config === 'string') {
    let config = undefined;
    try {
      const decoded = globalThis.distribution.util.deserialize(args.config);
  
      // If deserialize returns [err, value], unwrap it
      if (Array.isArray(decoded) && decoded.length === 2) {
        const maybeErr = decoded[0];
        if (maybeErr) throw maybeErr;
        config = decoded[1];
      } else {
        config = decoded;
      }
    } catch (error) {
      try {
        config = JSON.parse(args.config);
      } catch {
        console.error('Cannot deserialize config string: ' + args.config);
        process.exit(1);
      }
    }
  
    if (typeof config?.ip === 'string') {
      maybeIp = config.ip;
    }
    if (typeof config?.port === 'number') {
      maybePort = config.port;
    }
    if (typeof config?.onStart === 'function') {
      maybeOnStart = config.onStart;
    }
  }

  // Default values for config
  maybeIp = maybeIp ?? '127.0.0.1';
  maybePort = maybePort ?? 1234;

  return {
    ip: maybeIp,
    port: maybePort,
    onStart: maybeOnStart,
  };
}
/*
    The start function will be called to start your node.
    It will take a callback as an argument.
    After your node has booted, you should call the callback.
*/


/**
 * @param {(err?: Error | null) => void} callback
 * @returns {void}
 */
function start(callback) {
  const serialize = globalThis.distribution.util.serialize;
  const deserialize = globalThis.distribution.util.deserialize;

  const node = globalThis.distribution.node;
  const config = node.config;

  node.counts = 0;

  const server = http.createServer((req, res) => {

    // Only PUT supported
    if (req.method !== 'PUT') {
      res.statusCode = 405;
      return res.end(serialize([new Error('Only PUT supported'), null]));
    }

    node.counts++;

    // Parse path: /gid/service/method
    const parsedUrl = url.parse(req.url || '');
    const parts = (parsedUrl.pathname || '').split('/').filter(Boolean);

    if (parts.length !== 3) {
      res.statusCode = 400;
      return res.end(serialize([new Error('Invalid path'), null]));
    }

    const [gid, serviceName, methodName] = parts;

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {

      let args = [];

      try {
        args = body ? deserialize(body) : [];
      } catch (err) {
        res.statusCode = 400;
        return res.end(serialize([err, null]));
      }

      globalThis.distribution.local.routes.get({service: serviceName, gid }, (err, service) => {

        if (err || !service) {
          res.statusCode = 404;
          return res.end(serialize([err || new Error('Service not found'), null]));
        }

        const method = service[methodName];

        if (typeof method !== 'function') {
          res.statusCode = 404;
          return res.end(serialize([new Error('Method not found'), null]));
        }

        try {
          method(...args, (e, v) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(serialize([e || null, v]));
          });
        } catch (e) {
          res.statusCode = 500;
          res.end(serialize([e, null]));
        }
      });
    });
  });

  globalThis.distribution.node.server = server;

  server.once('listening', () => callback(null));
  server.once('error', err => callback(err));

  server.listen(config.port, config.ip);
}


module.exports = {start, config: setNodeConfig()};
