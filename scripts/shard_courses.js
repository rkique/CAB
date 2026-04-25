#!/usr/bin/env node

/**
 * Offline sharding step for AWS deployment.
 *
 * Reads:
 *   - courses_overview.json
 *   - embeddings.jsonl
 *   - cluster.json
 *
 * Writes:
 *   - shards/worker0.jsonl
 *   - shards/worker1.jsonl
 *   - shards/worker2.jsonl
 *   - all_keys.json
 *
 * Each output record is one JSON line and already includes the matching
 * embedding so the worker can stream-load its shard directly into local.store.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const idUtil = require('@brown-ds/distribution')().util.id;

const ROOT = path.resolve(__dirname, '..');
const CLUSTER_PATH = process.env.CLUSTER_CONFIG ?
  path.resolve(process.env.CLUSTER_CONFIG) :
  path.join(ROOT, 'cluster.json');
const COURSES_PATH = path.join(ROOT, 'courses_overview.json');
const EMBEDDINGS_PATH = path.join(ROOT, 'embeddings.jsonl');
const SHARDS_DIR = path.join(ROOT, 'shards');
const ALL_KEYS_PATH = path.join(ROOT, 'all_keys.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getWorkerGroup(cluster) {
  const group = {};
  for (const worker of cluster.workers) {
    const node = {ip: worker.ip, port: worker.distPort};
    group[idUtil.getSID(node)] = node;
  }
  return group;
}

function chooseWorkerForKey(key, workers) {
  const primaryKeyId = idUtil.getID(key);
  const nids = workers.map((w) => idUtil.getNID({ip: w.ip, port: w.distPort}));
  const chosenNid = idUtil.naiveHash(primaryKeyId, nids);
  const chosen = workers.find((w) => idUtil.getNID({ip: w.ip, port: w.distPort}) === chosenNid);
  if (!chosen) {
    throw new Error(`Unable to choose worker for key=${key}`);
  }
  return chosen;
}

async function loadEmbeddingsIndex(embeddingsPath) {
  if (!fs.existsSync(embeddingsPath)) {
    throw new Error(`Missing embeddings file: ${embeddingsPath}`);
  }

  const embeddings = new Map();
  const rl = readline.createInterface({input: fs.createReadStream(embeddingsPath)});
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    embeddings.set(obj.k, obj.v);
    count += 1;
    if (count % 10000 === 0) {
      console.log(`Indexed ${count} embeddings...`);
    }
  }

  console.log(`Loaded ${count} embeddings into memory.`);
  return embeddings;
}

function normalizeCourses(semesters) {
  const courses = [];

  for (const sem of semesters) {
    if (!sem || !Array.isArray(sem.results)) continue;

    for (const c of sem.results) {
      const srcdb = c.srcdb || sem.srcdb || '';
      const crn = c.crn || '';
      if (!srcdb || !crn) continue;

      const key = `${crn}:${srcdb}`;
      courses.push({
        key,
        value: {
          ...c,
          srcdb,
          crn,
          code: c.code || '',
          title: c.title || '',
          description: c.description || '',
          instr: c.instr || c.instructor || '',
          meets: c.meets || c.meeting_time || '',
        },
      });
    }
  }

  return courses;
}

async function main() {
  if (!fs.existsSync(CLUSTER_PATH)) {
    throw new Error(`Missing cluster config: ${CLUSTER_PATH}`);
  }
  if (!fs.existsSync(COURSES_PATH)) {
    throw new Error(`Missing courses file: ${COURSES_PATH}`);
  }

  const cluster = loadJson(CLUSTER_PATH);
  const semesters = loadJson(COURSES_PATH);
  const embeddings = await loadEmbeddingsIndex(EMBEDDINGS_PATH);
  const courses = normalizeCourses(semesters);

  fs.mkdirSync(SHARDS_DIR, {recursive: true});
  for (const worker of cluster.workers) {
    const shardPath = path.join(ROOT, worker.shardFile || `shards/${worker.name}.jsonl`);
    fs.mkdirSync(path.dirname(shardPath), {recursive: true});
    fs.writeFileSync(shardPath, '');
  }

  const allKeys = [];
  const shardStats = Object.fromEntries(cluster.workers.map((w) => [w.name, 0]));
  const fdCache = new Map();

  function appendLine(filePath, line) {
    let fd = fdCache.get(filePath);
    if (!fd) {
      fd = fs.openSync(filePath, 'a');
      fdCache.set(filePath, fd);
    }
    fs.writeSync(fd, line);
  }

  try {
    for (const course of courses) {
      const embedding = embeddings.get(course.key);
      if (!embedding) {
        continue;
      }

      course.value.embedding = embedding;
      const worker = chooseWorkerForKey(course.key, cluster.workers);
      const shardPath = path.join(ROOT, worker.shardFile || `shards/${worker.name}.jsonl`);

      appendLine(shardPath, JSON.stringify(course) + '\n');
      shardStats[worker.name] += 1;
      allKeys.push(course.key);
    }
  } finally {
    for (const fd of fdCache.values()) {
      fs.closeSync(fd);
    }
  }

  fs.writeFileSync(ALL_KEYS_PATH, JSON.stringify({
    gid: cluster.gid,
    workerGroup: getWorkerGroup(cluster),
    totalKeys: allKeys.length,
    keys: allKeys,
  }, null, 2));

  console.log(`Wrote ${allKeys.length} total course keys.`);
  console.log('Shard distribution:');
  for (const [workerName, count] of Object.entries(shardStats)) {
    console.log(`  ${workerName}: ${count}`);
  }
  console.log(`Saved worker shards under ${SHARDS_DIR}`);
  console.log(`Saved ${ALL_KEYS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});