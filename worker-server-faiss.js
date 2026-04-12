#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CLUSTER_PATH = process.env.CLUSTER_CONFIG ?
  path.resolve(process.env.CLUSTER_CONFIG) :
  path.join(__dirname, 'cluster.local.json');

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
const worker = (cluster.workers || []).find((w) => w.name === NODE_NAME);

if (!worker) {
  console.error(`Worker '${NODE_NAME}' not found in ${CLUSTER_PATH}`);
  process.exit(1);
}

const distribution = require('./distribution.js')({
  ip: worker.ip,
  port: worker.distPort,
});

const { buildLocalFaiss, localSearch } = require('./scripts/localIndex.js');

globalThis.__buildLocalFaiss = buildLocalFaiss;
globalThis.__localFaissSearch = localSearch;
globalThis.distribution = distribution;

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

function logWorkerGroup(label, group) {
    console.log(`[${NODE_NAME}] ${label}`);
    for (const [sid, node] of Object.entries(group)) {
      console.log(`  sid=${sid} -> ${node.ip}:${node.port}`);
    }
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
    logWorkerGroup('installing worker group', group);
  
    distribution.local.groups.put({ gid: GID }, group, (err, installed) => {
      if (err) return cb(err);
  
      console.log(`[${NODE_NAME}] local.groups.put returned ${Object.keys(installed || {}).length} members`);
      logWorkerGroup('installed worker group', installed || group);
      cb();
    });
}

startDistributionNode((err) => {
  if (err) {
    console.error('Failed to start worker distribution node:', err);
    process.exit(1);
  }

  installGroup((groupErr) => {
    if (groupErr) {
      console.error('Failed to install worker group:', groupErr);
      process.exit(1);
    }

    console.log(`Worker '${NODE_NAME}' is ready for FAISS build/search requests.`);
  });
});