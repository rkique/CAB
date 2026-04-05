#!/usr/bin/env node

const distribution = require('../../distribution.js')();
const id = distribution.util.id;

const dlibGroup = {};

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

const dataset = [
  {'b1-l1': 'It was the best of times, it was the worst of times,'},
  {'b1-l2': 'it was the age of wisdom, it was the age of foolishness,'},
  {'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,'},
  {'b1-l4': 'it was the season of Light, it was the season of Darkness,'},
  {'b1-l5': 'it was the spring of hope, it was the winter of despair,'},
];

const mapper = (key, value) => {
  const words = value.split(/\s+/).filter((w) => w !== '');
  return words.map((word) => {
    const out = {};
    out[word] = 1;
    return out;
  });
};

const reducer = (key, values) => {
  const out = {};
  out[key] = values.reduce((sum, v) => sum + v, 0);
  return out;
};

function hasRealError(e) {
  if (!e) return false;
  if (e instanceof Error) return true;
  if (typeof e !== 'object') return true;
  return Object.keys(e).length > 0;
}

function getDatasetKeys() {
  return dataset.map((o) => Object.keys(o)[0]);
}

function startNodes(cb) {
  distribution.local.status.spawn(n1, (e1) => {
    if (hasRealError(e1)) return cb(e1);

    distribution.local.status.spawn(n2, (e2) => {
      if (hasRealError(e2)) return cb(e2);

      distribution.local.status.spawn(n3, (e3) => {
        if (hasRealError(e3)) return cb(e3);
        cb(null);
      });
    });
  });
}

function setupCluster(cb) {
  dlibGroup[id.getSID(n1)] = n1;
  dlibGroup[id.getSID(n2)] = n2;
  dlibGroup[id.getSID(n3)] = n3;

  distribution.node.start((e) => {
    if (hasRealError(e)) return cb(e);

    startNodes((spawnErr) => {
      if (hasRealError(spawnErr)) return cb(spawnErr);

      const dlibConfig = {gid: 'dlib'};

      distribution.local.groups.put(dlibConfig, dlibGroup, (e1) => {
        if (hasRealError(e1)) return cb(e1);

        distribution.dlib.groups.put(dlibConfig, dlibGroup, (e2) => {
          if (hasRealError(e2)) return cb(e2);
          cb(null);
        });
      });
    });
  });
}

function loadDataset(cb) {
  let count = 0;

  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];

    distribution.dlib.store.put(value, key, (e) => {
      if (hasRealError(e)) return cb(e);

      count += 1;
      if (count === dataset.length) {
        cb(null);
      }
    });
  });
}

function verifyDataset(cb) {
  cb(null, getDatasetKeys());
}

function runOne(keys, cb) {
  const start = process.hrtime.bigint();

  distribution.dlib.mr.exec({keys, map: mapper, reduce: reducer}, (e, v) => {
    if (hasRealError(e)) return cb(e);

    const end = process.hrtime.bigint();
    const elapsedSeconds = Number(end - start) / 1e9;

    cb(null, {
      seconds: elapsedSeconds,
      output: v,
    });
  });
}

function runMany(keys, rounds, cb) {
  const latencies = [];
  let completed = 0;

  const totalStart = process.hrtime.bigint();

  const next = () => {
    if (completed >= rounds) {
      const totalEnd = process.hrtime.bigint();
      const totalSeconds = Number(totalEnd - totalStart) / 1e9;
      return cb(null, {
        rounds,
        latencies,
        totalSeconds,
      });
    }

    runOne(keys, (e, result) => {
      if (hasRealError(e)) return cb(e);
      latencies.push(result.seconds);
      completed += 1;
      next();
    });
  };

  next();
}

function shutdown(cb) {
  const remote = {service: 'status', method: 'stop'};

  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, () => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        cb();
      });
    });
  });
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function main() {
  const roundsArg = process.argv[2];
  const rounds = roundsArg ? Number(roundsArg) : 20;

  if (!Number.isInteger(rounds) || rounds <= 0) {
    console.error('Please provide a positive integer for the number of rounds.');
    process.exit(1);
  }

  setupCluster((setupErr) => {
    if (hasRealError(setupErr)) {
      console.error('Setup failed:', setupErr);
      process.exit(1);
    }

    loadDataset((loadErr) => {
      if (hasRealError(loadErr)) {
        console.error('Dataset load failed:', loadErr);
        return shutdown(() => process.exit(1));
      }

      verifyDataset((verifyErr, keys) => {
        if (hasRealError(verifyErr)) {
          console.error('Dataset verification failed:', verifyErr);
          return shutdown(() => process.exit(1));
        }

        runMany(keys, rounds, (benchErr, stats) => {
          if (hasRealError(benchErr)) {
            console.error('Benchmark failed:', benchErr);
            return shutdown(() => process.exit(1));
          }

          const avgLatency = average(stats.latencies);
          const throughput = stats.rounds / stats.totalSeconds;

          console.log('M5 DLIB BENCHMARK');
          console.log(`Rounds: ${stats.rounds}`);
          console.log(`Total time: ${stats.totalSeconds.toFixed(4)} s`);
          console.log(`Average latency: ${avgLatency.toFixed(6)} s/run`);
          console.log(`Throughput: ${throughput.toFixed(4)} runs/s`);

          shutdown(() => process.exit(0));
        });
      });
    });
  });
}

main();