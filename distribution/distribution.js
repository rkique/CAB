#!/usr/bin/env node
/**
 * @typedef {import("./distribution/types.js").Node} Node
 */

/**
 * @param {Node} [config]
 */
function bootstrap(config) {
  // This loads the reference implementation in case you want to selectively override parts of your implementation with it (e.g., extra credit ypu are not doing or missing functionality from previous milestones).
  // This needs to run before the rest of the code so that the globalThis.distribution object is populated correctly.
  // @ts-ignore Optional dependency for reference implementation.
  const distributionLib = require('@brown-ds/distribution')(config);
  distributionLib; // To avoid unused variable warning
  const distribution = {};

  // @ts-ignore This is the first time globalThis.distribution is being initialized, so the object does not have all the necessary properties.
  globalThis.distribution = distribution;
  distribution.util = require('./distribution/util/util.js');

  // @ts-ignore node.server is lazily initialized.
  distribution.node = require('./distribution/local/node.js');
  if (config) {
    distribution.node.config = config;
  }
  distribution.local = require('./distribution/local/local.js');

  const {setup} = require('./distribution/all/all.js');
  distribution.all = setup({gid: 'all'});
  distribution.all.nodes = {};
  /* Overrides when missing functionality from previous milestone or extra credit is needed */

  // __start_M3_solution__
  distribution.util.wire.createRPC = distributionLib.util.wire.createRPC;
  distribution.util.wire.toAsync = distributionLib.util.wire.toAsync;
  distribution.local.routes = distributionLib.local.routes;
  distribution.local.status.spawn = distributionLib.local.status.spawn;
  distribution.local.status.stop = distributionLib.local.status.stop;
  distribution.local.comm = distributionLib.local.comm;

  // Keep local serialization to avoid reference library deserialize runtime mismatch bugs.
  distribution.node = distributionLib.node;
  // __end_M3_solution__
  distribution.all.comm = distributionLib.all.comm;
  distribution.all.groups = distributionLib.all.groups;
  distribution.all.status = distributionLib.all.status;
  distribution.all.routes = distributionLib.all.routes;
  distribution.all.gossip = distributionLib.all.gossip;
  distribution.all.mem = distributionLib.all.mem;
  distribution.all.store = distributionLib.all.store;

  
  for (const [key, service] of Object.entries(distribution.local)) {
    distribution.local.routes.put(service, key, () => {});
  }

  return distribution;
}

/*
  This logic determines which implementation of the distribution library to use.
  It can either be:
  1. The reference implementation from the library @brown-ds/distribution
  2. Your own, local implementation
  Set "useLibrary" in package.json to true or false accordingly.
*/
// @ts-ignore JSON import resolved at runtime.
const {useLibrary, debug} = require('./package.json');
// @ts-ignore Optional dependency for reference implementation.
const distribution = useLibrary ? require('@brown-ds/distribution') : bootstrap;
globalThis.debug = debug ? true : false;

if (require.main === module) {
  globalThis.distribution = distribution();
  globalThis.distribution.node.start(globalThis.distribution.node.config.onStart || (() => {}));

}

/* The following code is run when distribution.js is invoked directly */
// if (require.main === module) {
//   globalThis.distribution = distribution();
//   globalThis.distribution.node.start(globalThis.distribution.node.config.onStart || (() => {
//     // Start REPL for interactive use
//     const repl = require('node:repl');
//     repl.start({
//       prompt: `${globalThis.distribution.util.id.getSID(globalThis.distribution.node.config)}> `,
//       input: process.stdin,
//       output: process.stdout,
//       terminal: true,
//       useGlobal: true,
//     });
//   }));
// }

module.exports = distribution;
