#!/usr/bin/env node
const DEPLOY_MODE = process.env.DEPLOY_MODE || 'distributed';
const { runIndexer, buildCourseMap, buildIndex } = require('../scripts/indexer.js');
const { generateRAGResponse } = require('../scripts/rag.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const {OpenAI} = require('openai');

// Import shared utilities from search-server.js
const {
  MAX_QUERY_LENGTH,
  MAX_REQUESTS_PER_DAY,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  getFaissK,
  filterSections,
  deduplicateResults,
  parseQueryFilters,
  getClientIP,
  checkRateLimit,
} = require('./search-server.js');

const CLUSTER_PATH = process.env.CLUSTER_CONFIG ?
  path.resolve(process.env.CLUSTER_CONFIG) :
  path.join(__dirname, '..', 'cluster.local.json');

if (!fs.existsSync(CLUSTER_PATH)) {
  console.error(`Missing cluster config: ${CLUSTER_PATH}`);
  process.exit(1);
}

const cluster = JSON.parse(fs.readFileSync(CLUSTER_PATH, 'utf8'));
const coordinator = cluster.coordinator;
const GID = cluster.gid || 'courses';
const DIST_PORT = coordinator.distPort;
const HTTP_PORT = coordinator.httpPort;

const keyPath = path.join(__dirname, '..', 'data', 'openai.key');
const OPENAI_API_KEY = fs.readFileSync(keyPath, 'utf8').trim();

const distribution = require('../distribution.js')({
  ip: coordinator.ip,
  port: DIST_PORT,
});

let allKeys = [];
let totalDocs = 0;
let openaiClient = null;

function logGroup(label, group) {
    console.log(`[coordinator] ${label}`);
    for (const [sid, node] of Object.entries(group)) {
      console.log(`  sid=${sid} -> ${node.ip}:${node.port}`);
    }
  }


// --- Cluster bootstrap ---
function buildWorkerGroup() {
    const id = distribution.util.id;
    const group = {};
    for (const w of cluster.workers) {
      const node = { ip: w.ip, port: w.distPort };
      group[id.getSID(node)] = node;
    }
    return group;
  }

// startup
function startDistributionNode(cb) {
  distribution.node.start(() => {
    console.log(`Distribution node started on port ${DIST_PORT}`);
    cb();
  });
}

function setupWorkerGroup(cb) {
    const group = buildWorkerGroup();
    logGroup('installing worker group', group);
  
    distribution.local.groups.put({ gid: GID }, group, (err, installed) => {
      if (err) return cb(err);
  
      console.log(`[coordinator] local.groups.put returned ${Object.keys(installed || {}).length} workers`);
      logGroup('installed worker group', installed || group);
      cb();
    });
  }

async function loadIndex(cb) {
  /* Load the course index and embeddings, then build the FAISS index on each node. */
  
  console.log('Running indexer...');

  const { index } = await runIndexer(distribution, GID);

  allKeys = Object.keys(index);
  totalDocs = allKeys.length;
  console.log(`Index has ${totalDocs} unique courses.`);

  const faissService = {
    buildFaiss: function(gid, keys, cb2) {
      console.log('buildFaiss called!', gid, 'keys:', keys.length);

      const records = [];
      let pending = keys.length;

      if (pending === 0) return cb2(null, { built: 0 });

      keys.forEach((key) => {
        globalThis.distribution.local.store.get({ key, gid }, (err, record) => {
          if (!err && record) records.push(record);
          pending--;

          if (pending === 0) {
            if (typeof globalThis.__buildLocalFaiss !== 'function') {
              return cb2(new Error('__buildLocalFaiss is not available on this worker'));
            }
            globalThis.__buildLocalFaiss(records);
            const sampleCodes = records.slice(0, 5).map((r) => r.code);
            console.log(`[worker-faiss] built local FAISS with ${records.length} courses`);
            console.log(`[worker-faiss] sample local codes: ${sampleCodes.join(', ')}`);
            cb2(null, { built: records.length });
          }
        });
      });
    },
  };

  distribution[GID].routes.put(faissService, 'faiss', (err, val) => {
    console.log('routes.put callback fired, err:', err, 'val:', val);
    if (err && Object.values(err).length > 0) return cb(err);

    console.log('sending buildFaiss to all workers...');
    distribution[GID].comm.send(
      [GID, allKeys],
      { service: 'faiss', method: 'buildFaiss' },
      (sendErr, results) => {
        if (sendErr && Object.values(sendErr).some(Boolean)) return cb(sendErr);
        console.log('All workers built local FAISS:', results);
        cb();
      }
    );
  });
}

// --- OpenAI helpers ---
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return openaiClient;
}

async function embedQueryFaiss(queryStr) {
  const client = getOpenAIClient();
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: queryStr,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  const raw = res.data[0].embedding;
  const norm = Math.sqrt(raw.reduce((s, x) => s + x * x, 0));
  return raw.map((x) => x / norm);
}

// --- Distributed FAISS search ---
function searchFaiss(queryVec, queryStr, t0, cb) {
  const topK = 40;
  const filters = parseQueryFilters(queryStr);
  const filtersJson = JSON.stringify(filters);
  const hasFilters = filters.days || filters.season || filters.year;
  const faissK = getFaissK(topK, filters);
  const queryVecJson = JSON.stringify(queryVec);
  const searchId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const map = new Function('key', 'value', `
    var sid = '__faiss_${searchId}';
    if (globalThis[sid]) return [];
    globalThis[sid] = true;

    var filters = ${filtersJson};
    var hasFilters = ${hasFilters ? 'true' : 'false'};

    varSearchFn = hasFilters && typeof globalThis.__localFaissSearchFiltered === 'function' ? globalThis.__localFaissSearchFiltered : globalThis.__localFaissSearch;
    if (typeof globalThis.__localFaissSearch !== 'function') {
      throw new Error('__localFaissSearch not ready — buildFaiss may not have run');
    }

    var queryVector = ${queryVecJson};
    var results = hasFilters ? searchFn(queryVector, ${faissK}, filters) : searchFn(queryVector, ${faissK});
    console.log('[worker-query] local FAISS returned ' + results.length + ' hits');
    if (results.length > 0) {
    console.log('[worker-query] top local codes: ' + results.slice(0, 5).map(function(r) { return r.code; }).join(', '));
    }
    return results.map(function(r) {
      var o = {};
      o['results'] = r;
      return o;
    });
  `);

  const reduce = (_, values) => {
    const out = {};
    out.results = values;
    return out;
  };

  distribution[GID].mr.exec({ keys: allKeys, map, reduce }, (err, results) => {
    if (err) return cb(err);

    const docs = [];
    for (const item of results) {
      if (item.results) {
        const v = item.results;
        if (Array.isArray(v)) docs.push(...v);
        else docs.push(v);
      }
    }
    console.log(`[coordinator] gathered ${docs.length} raw local FAISS hits from workers`);

    const seen = new Set();
    const merged = docs
      .sort((a, b) => b.score - a.score)
      .filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      })
      .slice(0, faissK);

    if (merged.length === 0) {
      return cb(null, {
        results: [],
        time_ms: Date.now() - t0,
        total_docs: totalDocs,
        mode: `faiss-${DEPLOY_MODE}`,
        filters,
      });
    }
    console.log(`[coordinator] merged down to ${merged.length} unique candidate courses`);
    console.log('[coordinator] top merged codes:', merged.slice(0, 10).map((r) => r.code).join(', '));


    let pending = merged.length;
    const fullResults = [];
    let errored = false;

    merged.forEach(({ code, score }) => {
        distribution[GID].store.get(code, (getErr, record) => {
          if (errored) return;
          if (getErr) {
            errored = true;
            return cb(getErr);
          }
      
          fullResults.push({ ...record, score });
          pending--;
      
          if (pending === 0) {
            const filtered = filterSections(fullResults, filters);
            const deduped = deduplicateResults(filtered);
            const ranked = deduped.sort((a, b) => b.score - a.score).slice(0, topK);
      
            console.log(`[coordinator] fetched ${fullResults.length} full records from distributed store`);
            console.log(`[coordinator] final ranked results: ${ranked.length}`);
            console.log('[coordinator] final top codes:', ranked.slice(0, 10).map((r) => r.code).join(', '));
      
            cb(null, {
              results: ranked,
              time_ms: Date.now() - t0,
              total_docs: totalDocs,
              mode: `faiss-${DEPLOY_MODE}`,
              filters,
            });
          }
        });
      });
    });
}

function search(queryStr, cb) {
  const t0 = Date.now();

  embedQueryFaiss(queryStr).then((queryVec) => {
    searchFaiss(queryVec, queryStr, t0, async (err, faissResult) => {
      if (err) return cb(err);

      try {
        const { answer, cited_courses } = await generateRAGResponse(
          getOpenAIClient(),
          queryStr,
          faissResult.results
        );

        cb(null, {
          answer,
          cited_courses,
          results: faissResult.results,
          time_ms: Date.now() - t0,
          total_docs: faissResult.total_docs,
          mode: `faiss+rag-${DEPLOY_MODE}`,
          filters: faissResult.filters,
        });
      } catch (ragErr) {
        console.warn('RAG generation failed, returning FAISS results only:', ragErr.message);
        cb(null, faissResult);
      }
    });
  }).catch((err) => {
    console.error('Embedding failed:', err.message || err);
    cb(err);
  });
}

// --- HTTP server ---
function startHTTPServer() {
  const htmlPath = path.join(__dirname, 'search.html');

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
      return;
    }

    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        mode: DEPLOY_MODE,
        gid: GID,
        total_docs: totalDocs,
        coordinator: coordinator.name,
        workers: cluster.workers.map((w) => ({ name: w.name, ip: w.ip, port: w.distPort })),
      }));
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/images/')) {
      const filePath = path.join(__dirname, req.url);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    if (req.method === 'POST' && req.url === '/search') {
      const clientIP = getClientIP(req);

      if (!checkRateLimit(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Daily request limit reached. Please try again tomorrow.' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const { query } = JSON.parse(body);
          if (!query || typeof query !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing query string' }));
            return;
          }

          if (query.length > MAX_QUERY_LENGTH) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters).` }));
            return;
          }

          search(query, (err, result) => {
            if (err) {
              console.error('Search error:', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          });
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`[${DEPLOY_MODE}] Search UI at http://localhost:${HTTP_PORT}`);
  });
}

// --- Startup sequence ---
startDistributionNode((err) => {
  if (err) {
    console.error('Coordinator start failed:', err);
    process.exit(1);
  }

  setupWorkerGroup((groupErr) => {
    if (groupErr) {
      console.error('Worker group setup failed:', groupErr);
      process.exit(1);
    }

    loadIndex((loadErr) => {
      if (loadErr && Object.values(loadErr).length > 0) {
        console.error('Distributed-local index load failed:', loadErr);
        process.exit(1);
      }

      startHTTPServer();
    });
  });
});