#!/usr/bin/env node
// @ts-check

require('../distribution.js')();

const distribution = globalThis.distribution;
const id = distribution.util.id;

const n1 = { ip: '127.0.0.1', port: 7110 };
const n2 = { ip: '127.0.0.1', port: 7111 };
const n3 = { ip: '127.0.0.1', port: 7112 };

const RUNS = 20;
const WARMUP_RUNS = 5;

const dlibDataset = [
  { 'b1-l1': 'It was the best of times, it was the worst of times,' },
  { 'b1-l2': 'it was the age of wisdom, it was the age of foolishness,' },
  { 'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,' },
  { 'b1-l4': 'it was the season of Light, it was the season of Darkness,' },
  { 'b1-l5': 'it was the spring of hope, it was the winter of despair,' },
];

const dlibMapper = (key, value) => {
  const words = value.split(/(\s+)/).filter((e) => e !== ' ');
  const out = [];
  for (const word of words) {
    out.push({ [word]: 1 });
  }
  return out;
};

const dlibReducer = (key, values) => {
  const out = {};
  out[key] = values.reduce((sum, v) => sum + v, 0);
  return out;
};

function hasSendError(err) {
  return !!(err && (typeof err !== 'object' || Object.keys(err).length > 0));
}

function call(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, value) => {
      if (hasSendError(err) || err instanceof Error) {
        reject(err);
        return;
      }
      resolve(value);
    });
  });
}

function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function setupCluster() {
  const dlibGroup = {
    [id.getSID(n1)]: n1,
    [id.getSID(n2)]: n2,
    [id.getSID(n3)]: n3,
  };

  await call(distribution.node.start.bind(distribution.node));
  await call(distribution.local.status.spawn.bind(distribution.local.status), n1);
  await call(distribution.local.status.spawn.bind(distribution.local.status), n2);
  await call(distribution.local.status.spawn.bind(distribution.local.status), n3);

  const dlibConfig = { gid: 'dlib' };
  await call(distribution.local.groups.put.bind(distribution.local.groups), dlibConfig, dlibGroup);
  await call(distribution.dlib.groups.put.bind(distribution.dlib.groups), dlibConfig, dlibGroup);
}

async function putDataset() {
  for (const row of dlibDataset) {
    const key = Object.keys(row)[0];
    const value = row[key];
    await call(distribution.dlib.store.put.bind(distribution.dlib.store), value, key);
  }
  const keys = await call(distribution.dlib.store.get.bind(distribution.dlib.store), null);
  if (!Array.isArray(keys) || keys.length !== dlibDataset.length) {
    throw new Error('Dataset did not load as expected for dlib characterization');
  }
  return keys;
}

async function stopCluster() {
  const remote = { service: 'status', method: 'stop', node: n1 };
  try {
    await call(distribution.local.comm.send.bind(distribution.local.comm), [], remote);
  } catch (_e) {}

  remote.node = n2;
  try {
    await call(distribution.local.comm.send.bind(distribution.local.comm), [], remote);
  } catch (_e) {}

  remote.node = n3;
  try {
    await call(distribution.local.comm.send.bind(distribution.local.comm), [], remote);
  } catch (_e) {}

  if (distribution.node.server) {
    distribution.node.server.close();
  }
}

async function run() {
  const startedAt = Date.now();
  const latenciesMs = [];

  await setupCluster();

  try {
    const keys = await putDataset();

    for (let i = 0; i < WARMUP_RUNS + RUNS; i++) {
      const t0 = process.hrtime.bigint();
      const results = await call(
        distribution.dlib.mr.exec.bind(distribution.dlib.mr),
        { keys, map: dlibMapper, reduce: dlibReducer },
      );
      const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;

      if (!Array.isArray(results) || results.length === 0) {
        throw new Error('MR returned empty results during characterization run');
      }

      if (i >= WARMUP_RUNS) {
        latenciesMs.push(elapsedMs);
      }
    }
  } finally {
    await stopCluster();
  }

  const totalMs = latenciesMs.reduce((acc, v) => acc + v, 0);
  const avgLatencyMs = mean(latenciesMs);
  const throughputOpsPerSec = (latenciesMs.length / totalMs) * 1000;

  const result = {
    scenario: 'all.mr:dlib',
    environment: 'dev',
    runs: RUNS,
    warmupRuns: WARMUP_RUNS,
    avgLatencyMs: Number(avgLatencyMs.toFixed(2)),
    p50LatencyMs: Number(percentile(latenciesMs, 50).toFixed(2)),
    p95LatencyMs: Number(percentile(latenciesMs, 95).toFixed(2)),
    throughputOpsPerSec: Number(throughputOpsPerSec.toFixed(2)),
    measuredAt: new Date(startedAt).toISOString(),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

run().catch((err) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`m5 characterization failed: ${message}\n`);
  process.exit(1);
});
