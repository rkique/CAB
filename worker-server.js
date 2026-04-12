#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CLUSTER_PATH = process.env.CLUSTER_CONFIG ?
  path.resolve(process.env.CLUSTER_CONFIG) :
  path.join(__dirname, 'cluster.json');
const NODE_NAME = process.env.NODE_NAME;

if (!NODE_NAME) {
  console.error('NODE_NAME environment variable is required.');
  process.exit(1);
}

if (!fs.existsSync(CLUSTER_PATH)) {
  console.error(`Missing cluster config: ${CLUSTER_PATH}`);
  process.exit(1);
}

const cluster = JSON.parse(fs.readFileSync(CLUSTER_PATH, 'utf8'));
const worker = cluster.workers.find((w) => w.name === NODE_NAME);
if (!worker) {
  console.error(`Worker '${NODE_NAME}' not found in ${CLUSTER_PATH}`);
  process.exit(1);
}

const distribution = require('./distribution.js')({
  ip: worker.ip,
  port: worker.distPort,
});

const GID = cluster.gid || 'courses';

function buildWorkerGroup() {
  const id = distribution.util.id;
  const group = {};
  for (const w of cluster.workers) {
    const node = {ip: w.ip, port: w.distPort};
    group[id.getSID(node)] = node;
  }
  return group;
}

function startDistributionNode(cb) {
  distribution.node.start((err) => {
    if (err) return cb(err);
    console.log(`Worker '${NODE_NAME}' listening on ${worker.ip}:${worker.distPort}`);
    cb();
  });
}

function installGroup(cb) {
  const group = buildWorkerGroup();
  distribution.local.groups.put({gid: GID}, group, cb);
}

function loadShard(cb) {
  const shardPath = path.join(__dirname, worker.shardFile || `shards/${worker.name}.jsonl`);
  if (!fs.existsSync(shardPath)) {
    return cb(new Error(`Missing shard file: ${shardPath}`));
  }

  const rl = readline.createInterface({input: fs.createReadStream(shardPath)});
  let pending = 0;
  let closed = false;
  let failed = false;
  let count = 0;
  const HIGH_WATER = 256;

  const maybeDone = () => {
    if (!failed && closed && pending === 0) {
      console.log(`Worker '${NODE_NAME}' loaded ${count} records into local.store gid='${GID}'.`);
      cb();
    }
  };

  rl.on('line', (line) => {
    if (failed || !line.trim()) return;
    rl.pause();

    let record;
    try {
      record = JSON.parse(line);
    } catch (err) {
      failed = true;
      rl.close();
      return cb(err);
    }

    pending += 1;
    distribution.local.store.put(record.value, {gid: GID, key: record.key}, (err) => {
      pending -= 1;
      if (failed) return;
      if (err) {
        failed = true;
        rl.close();
        return cb(err);
      }

      count += 1;
      if (count % 5000 === 0) {
        console.log(`Worker '${NODE_NAME}' loaded ${count} records...`);
      }

      if (pending < HIGH_WATER) {
        rl.resume();
      }
      maybeDone();
    });

    if (pending < HIGH_WATER) {
      rl.resume();
    }
  });

  rl.on('close', () => {
    closed = true;
    maybeDone();
  });

  rl.on('error', cb);
}

startDistributionNode((err) => {
  if (err) {
    console.error('Failed to start distribution node:', err);
    process.exit(1);
  }

  installGroup((groupErr) => {
    if (groupErr) {
      console.error('Failed to install worker group:', groupErr);
      process.exit(1);
    }

    loadShard((loadErr) => {
      if (loadErr) {
        console.error('Failed to load shard:', loadErr);
        process.exit(1);
      }
      console.log(`Worker '${NODE_NAME}' is ready.`);
    });
  });
});