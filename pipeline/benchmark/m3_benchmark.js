const distribution = require('../distribution.js')();
const id = distribution.util.id;

function withTimeout(label, ms, fn) {
  let done = false;
  const t = setTimeout(() => {
    if (done) return;
    done = true;
    console.error(`TIMEOUT: ${label}`);
    process.exit(1);
  }, ms);

  fn((...args) => {
    if (done) return;
    done = true;
    clearTimeout(t);
    // @ts-ignore
    return args.length ? args[0](...args.slice(1)) : undefined;
  });
}

function startController(cb) {
  const ip = '127.0.0.1';
  let port = 9123;

  function tryPort() {
    distribution.node.config.ip = ip;
    distribution.node.config.port = port;

    distribution.node.start((err) => {
      if (!err) {
        console.log(`controller started at ${ip}:${port}`);
        return cb(null);
      }
      if (err.code === 'EADDRINUSE') {
        port += 1;
        return tryPort();
      }
      cb(err);
    });
  }

  tryPort();
}

function stopNodes(nodes, cb) {
  const remote = { service: 'status', method: 'stop' };
  let i = 0;

  function step() {
    if (i >= nodes.length) return cb();
    remote.node = nodes[i];

    // Guard: if comm/send hangs, we still move on
    let finished = false;
    const t = setTimeout(() => {
      if (finished) return;
      finished = true;
      i++;
      step();
    }, 800);

    distribution.local.comm.send([], remote, () => {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      i++;
      step();
    });
  }

  step();
}

startController((err) => {
  if (err) {
    console.error('controller start failed:', err);
    process.exit(1);
  }

  const counts = [1, 2, 4, 8, 16];
  const repsPerCount = 5;

  let basePort = 10000;
  const results = [];

  let trial = 0;
  let rep = 0;
  let times = [];

  function runOne() {
    if (trial >= counts.length) {
      if (globalThis.distribution.node.server) globalThis.distribution.node.server.close();
      console.log('\nSpawn benchmark results:');
      for (const r of results) {
        console.log(`count=${r.count} avg_ms=${r.avg_ms} times_ms=${JSON.stringify(r.times_ms)}`);
      }
      process.exit(0);
    }

    const count = counts[trial];
    const nodes = [];
    for (let i = 0; i < count; i++) nodes.push({ ip: '127.0.0.1', port: basePort + i });

    console.log(`\ncount=${count} rep=${rep + 1}/${repsPerCount} ports=${basePort}..${basePort + count - 1}`);

    // define group (lets you use distribution.bench.* if you want)
    const group = {};
    for (const n of nodes) group[id.getSID(n)] = n;

    distribution.local.groups.put({ gid: 'bench' }, group, (ePut) => {
      if (ePut) {
        console.error('groups.put failed:', ePut);
        process.exit(1);
      }

      const start = process.hrtime.bigint();
      let doneCount = 0;

      for (const n of nodes) {
        console.log(`  spawning ${n.ip}:${n.port}`);

        // Guard each spawn so one stuck node doesn’t hang forever
        let finished = false;
        const t = setTimeout(() => {
          if (finished) return;
          finished = true;
          console.error(`TIMEOUT: spawn ${n.ip}:${n.port}`);
          process.exit(1);
        }, 3000);

        distribution.local.status.spawn(n, (eSpawn) => {
          if (finished) return;
          finished = true;
          clearTimeout(t);

          if (eSpawn) {
            console.error('spawn failed:', n, eSpawn);
            process.exit(1);
          }

          doneCount++;
          if (doneCount === nodes.length) {
            const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
            times.push(elapsedMs);
            console.log(`  spawned ${count} nodes in ${elapsedMs.toFixed(2)} ms`);

            // stop them (guarded)
            stopNodes(nodes, () => {
              rep++;

              if (rep === repsPerCount) {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                results.push({
                  count,
                  avg_ms: avg.toFixed(2),
                  times_ms: times.map((t) => Number(t.toFixed(2))),
                });
                rep = 0;
                times = [];
                trial++;
                basePort += 100;
              }

              runOne();
            });
          }
        });
      }
    });
  }

  runOne();
});