// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const fs = require('fs');
const path = require('path');
const proc = require('node:child_process');

//singular node: variable s

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  const id = distribution.util.id;
  //object configuration has value "sid", "nid", "ip", "port", "counts", "heapTotal", or "heapUsed"
  //should implement the ability to get string implementations from callback
  if (configuration == 'nid') {
     return callback(null, id.getNID(distribution.node.config));
  } else if (configuration == 'sid') {
      return callback(null, id.getSID(distribution.node.config));
  } else if (configuration == 'ip') {
    return callback(null, distribution.node.config.ip);
  } else if (configuration == 'port') {
    return callback(null, distribution.node.config.port);
  } else if (configuration == 'counts') {
    console.log('[getting counts] ' + distribution.node.counts);
    return callback(null, distribution.node.counts);
  } else if (configuration == 'heapTotal') {
    return callback(null, process.memoryUsage().heapTotal);
  } else if (configuration == 'heapUsed') {
    return callback(null, process.memoryUsage().heapUsed);
  }
  else {
    console.log('[getting badconfig] ' + configuration);
    return callback(new Error('Unsupported configuration: ' + configuration), null);
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  const nodeConfig = { ...configuration };
  nodeConfig.onStart = nodeConfig.onStart || function() {};

  if (!nodeConfig.port || !nodeConfig.ip) {
    callback(new Error('Port and IP are required in the configuration'));
    return;
  }

  const onSpawnReady = (err, startedNodeConfig) => {
    if (err) {
      callback(err);
      return;
    }
    distribution.local.groups.add('all', startedNodeConfig, () => {
      callback(null, startedNodeConfig);
    });
  };

  const createOnStart = (onStart, onReady) => {
    const callbackRPC = distribution.util.wire.createRPC(
        distribution.util.wire.toAsync(onReady),
    );
    const code = `
      return function(e) {
        let onStart = ${onStart.toString()};
        let callbackRPC = ${callbackRPC.toString()};
        if (e) {
          callbackRPC(e, null, () => {});
          return;
        }
        try {
          onStart();
          callbackRPC(null, globalThis.distribution.node.config, () => {});
        } catch (e) {
          callbackRPC(e, null, () => {});
        }
      };
    `;
    return new Function(code)();
  };

  nodeConfig.onStart = createOnStart(nodeConfig.onStart, onSpawnReady);

  const candidatePaths = [
    path.resolve(process.cwd(), 'distribution.js'),
    path.resolve(__dirname, '../../distribution.js'),
  ];
  const distributionPath = candidatePaths.find((p) => fs.existsSync(p));

  if (!distributionPath) {
    callback(new Error('Could not locate project distribution.js for spawn'));
    return;
  }

  proc.spawn(
      'node',
      [distributionPath, '--config', distribution.util.serialize(nodeConfig)],
      { detached: true, stdio: 'inherit' },
  );
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  if (globalThis.distribution?.node?.server) {
    globalThis.distribution.node.server.close();
  }
  process.nextTick(() => process.exit(0));
  callback(null, globalThis.distribution.node.config);
}

module.exports = {get, spawn, stop};
