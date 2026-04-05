// run_node.js
require('./distribution.js')();

globalThis.distribution.node.start((err) => {
  if (err) {
    console.error('Failed to start node:', err);
    process.exit(1);
  }
  const { ip, port } = globalThis.distribution.node.config;
  console.log(`Node listening on ${ip}:${port}`);
});