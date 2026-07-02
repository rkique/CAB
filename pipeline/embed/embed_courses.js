#!/usr/bin/env node
/**
 * embed_courses.js
 *
 * One-time script. Reads courses_overview.json, generates 256-dim
 * embeddings using OpenAI text-embedding-3-small, and writes embeddings.jsonl:
 * one JSON line per course: {"k":"crn:srcdb","v":[...256 floats...]}
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... node embed_courses.js
 *
 * Output:
 *   embeddings.jsonl  (gitignored)
 *
 * Resume-safe: if embeddings.jsonl already exists, already-computed keys are
 * skipped and new entries are appended.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const {OpenAI} = require('openai');

const KEY_FILE = path.join(__dirname, '..', '..', 'data', 'openai.key');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses_overview.json');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.jsonl');
const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');

const BATCH_SIZE = 200;
const CONCURRENCY = 1;
const DIMENSIONS = 256;
const MODEL = 'text-embedding-3-small';
const RETRY_LIMIT = 6;

function computeTextHash(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    return {
      version: '1.0',
      cab: {srcdbs: {}},
      embeddings: {model: MODEL, dimensions: DIMENSIONS, records: {}},
      criticalReview: {enabled: false},
    };
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  } catch (_) {
    return {
      version: '1.0',
      cab: {srcdbs: {}},
      embeddings: {model: MODEL, dimensions: DIMENSIONS, records: {}},
      criticalReview: {enabled: false},
    };
  }
}

function saveManifest(mf) {
  const tmp = MANIFEST_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(mf, null, 2));
  fs.renameSync(tmp, MANIFEST_FILE);
}

function shouldEmbed(mf, key, text) {
  const rec = (mf.embeddings?.records || {})[key];
  if (!rec) return true;
  if (mf.embeddings?.model !== MODEL || mf.embeddings?.dimensions !== DIMENSIONS) return true;
  return computeTextHash(text) !== rec.textHash;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

//Async function for embedBatch
async function embedBatch(client, texts) {
  let delay = 5000;
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    try {
      const res = await client.embeddings.create({
        model: MODEL,
        input: texts,
        dimensions: DIMENSIONS,
      });
      return res.data.map((d) => d.embedding);
    } catch (e) {
      if (e.status === 429 && attempt < RETRY_LIMIT - 1) {
        console.warn(`  Rate limit hit, waiting ${(delay / 1000).toFixed(0)}s before retry...`);
        await sleep(delay);
        delay *= 2;
      } else {
        throw e;
      }
    }
  }
}

async function loadDoneKeys() {
  const done = new Set();
  if (!fs.existsSync(EMBEDDINGS_FILE)) return done;
  const rl = readline.createInterface({input: fs.createReadStream(EMBEDDINGS_FILE)});
  for await (const line of rl) {
    if (!line.trim()) continue;
    done.add(JSON.parse(line).k);
  }
  return done;
}

function appendBatch(batch, vecs) {
  let lines = '';
  for (let j = 0; j < batch.length; j++) {
    lines += JSON.stringify({k: batch[j].key, v: vecs[j]}) + '\n';
  }
  fs.appendFileSync(EMBEDDINGS_FILE, lines);
}

function buildEmbeddingText(c) {
  const parts = [];
  if (c.code) parts.push(`${c.code}:`);
  parts.push(`${c.title || ''}.`);
  if (c.instr) parts.push(`Instructor: ${c.instr}.`);
  if (Array.isArray(c.programs) && c.programs.length > 0) {
    parts.push(`Programs: ${c.programs.join(', ')}.`);
  }
  parts.push(c.description || '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`Error: ${KEY_FILE} not found.`);
    process.exit(1);
  }
  const apiKey = fs.readFileSync(KEY_FILE, 'utf8').trim();

  const client = new OpenAI({apiKey});

  const raw = fs.readFileSync(COURSES_FILE, 'utf8');
  const semesters = JSON.parse(raw);

  const courses = [];
  for (const sem of semesters) {
    if (!sem.results) continue;
    for (const c of sem.results) {
      const key = `${c.crn}:${c.srcdb || sem.srcdb || ''}`;
      const text = buildEmbeddingText(c);
      courses.push({key, text});
    }
  }
  console.log(`Parsed ${courses.length} courses.`);

  const doneKeys = await loadDoneKeys();
  if (doneKeys.size > 0) {
    console.log(`Resuming: ${doneKeys.size} embeddings already computed.`);
  }

  const mf = loadManifest();

  // Bootstrap: if manifest has no embedding records but embeddings exist on disk,
  // trust the existing embeddings and populate manifest hashes from current text.
  const manifestRecordCount = Object.keys(mf.embeddings?.records || {}).length;
  if (manifestRecordCount === 0 && doneKeys.size > 0) {
    console.log(`Bootstrapping manifest with ${doneKeys.size} existing embedding hashes...`);
    if (!mf.embeddings.records) mf.embeddings.records = {};
    for (const c of courses) {
      if (doneKeys.has(c.key)) {
        mf.embeddings.records[c.key] = {
          textHash: computeTextHash(c.text),
          createdAt: new Date().toISOString(),
        };
      }
    }
    saveManifest(mf);
    console.log(`Bootstrapped ${Object.keys(mf.embeddings.records).length} manifest records.`);
  }

  // Filter: embed if key is missing OR text has changed (stale)
  const todo = [];
  const staleKeys = new Set();
  for (const c of courses) {
    if (!doneKeys.has(c.key)) {
      todo.push(c);
    } else if (shouldEmbed(mf, c.key, c.text)) {
      todo.push(c);
      staleKeys.add(c.key);
    }
  }

  if (staleKeys.size > 0) {
    console.log(`Found ${staleKeys.size} stale embedding(s) to regenerate.`);
  }
  console.log(`Embedding ${todo.length} remaining courses...`);
  console.log(`Model: ${MODEL}, dimensions: ${DIMENSIONS}, batch: ${BATCH_SIZE}`);

  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    batches.push(todo.slice(i, i + BATCH_SIZE));
  }

  let done = 0;
  const t0 = Date.now();

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);

    await Promise.all(chunk.map(async (batch) => {
      const texts = batch.map((c) => c.text);
      const vecs = await embedBatch(client, texts);
      appendBatch(batch, vecs);

      // Update manifest with text hashes
      for (const c of batch) {
        const hash = computeTextHash(c.text);
        if (!mf.embeddings.records) mf.embeddings.records = {};
        mf.embeddings.records[c.key] = {
          textHash: hash,
          createdAt: new Date().toISOString(),
        };
      }
    }));

    done += chunk.reduce((sum, b) => sum + b.length, 0);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const pct = ((done / todo.length) * 100).toFixed(1);
    const rate = (done / ((Date.now() - t0) / 1000)).toFixed(0);
    console.log(`  ${done}/${todo.length} (${pct}%) — ${elapsed}s elapsed — ${rate} courses/s`);
  }

  // If stale keys were re-embedded, dedup embeddings.jsonl (keep last occurrence)
  if (staleKeys.size > 0) {
    console.log('Deduplicating embeddings.jsonl...');
    const seen = new Map();
    const rl2 = readline.createInterface({input: fs.createReadStream(EMBEDDINGS_FILE)});
    for await (const line of rl2) {
      if (!line.trim()) continue;
      const k = JSON.parse(line).k;
      seen.set(k, line);
    }
    const tmp = EMBEDDINGS_FILE + '.tmp';
    const ws = fs.createWriteStream(tmp);
    for (const line of seen.values()) {
      ws.write(line + '\n');
    }
    await new Promise((resolve) => ws.end(resolve));
    fs.renameSync(tmp, EMBEDDINGS_FILE);
    console.log(`Deduplicated: ${seen.size} unique embeddings.`);
  }

  // Save manifest
  saveManifest(mf);

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done. ${doneKeys.size + todo.length} embeddings in ${total}s.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
