const distribution = require('../../distribution.js')();

const NUM_REQUESTS = 1000;

// Echo service
const echoService = {
  ping: (cb) => cb(null, "pong")
};

// Start node server first
distribution.node.start(async (err) => {
  if (err) {
    console.error("Failed to start node:", err);
    process.exit(1);
  }

  console.log("Node started on", distribution.node.config);

  // Register echo service
  distribution.local.routes.put(echoService, 'echo', async () => {

    const self = distribution.node.config;

    async function benchmark(label, sender) {
      const start = process.hrtime.bigint();

      const promises = [];

      for (let i = 0; i < NUM_REQUESTS; i++) {
        promises.push(new Promise((resolve, reject) => {
          sender((err, value) => {
            if (err) reject(err);
            else resolve(value);
          });
        }));
      }

      await Promise.all(promises);

      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      console.log(`\n=== ${label} ===`);
      console.log(`Total time: ${durationMs.toFixed(2)} ms`);
      console.log(`Throughput: ${(NUM_REQUESTS / (durationMs / 1000)).toFixed(2)} req/sec`);
      console.log(`Avg latency: ${(durationMs / NUM_REQUESTS).toFixed(4)} ms`);
    }

    // COMM benchmark
    await benchmark("COMM", (cb) => {
      const message = [];
      const remote = {
        node: self,
        service: 'echo',
        method: 'ping'
      };

      distribution.local.comm.send(message, remote, cb);
    });

    // RPC benchmark (only if implemented)
    if (distribution.local.rpc) {
      await benchmark("RPC", (cb) => {
        const message = [];
        const remote = {
          node: self,
          service: 'echo',
          method: 'ping'
        };

        distribution.local.rpc.send(message, remote, cb);
      });
    }

    console.log("\nTotal server requests handled:", distribution.node.counts);

    process.exit(0);
  });
});
