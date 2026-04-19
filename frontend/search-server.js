#!/usr/bin/env node

const { runIndexer, buildCourseMap, buildIndex } = require('../scripts/indexer.js');
const { generateRAGResponse } = require('../scripts/rag.js');

const http = require('http');
const fs = require('fs');
const path = require('path');

// load localIndex at module level — require works here
const { buildLocalFaiss, localSearch, localSearchFiltered } = require('../scripts/localIndex.js');
globalThis.__buildLocalFaiss = buildLocalFaiss;
globalThis.__localFaissSearch = localSearch;
globalThis.__localFaissSearchFiltered = localSearchFiltered;

const LOCAL_MODE = process.argv.includes('--local');
const DIST_PORT = 3001;
const HTTP_PORT = 3000;
const GID = 'courses';
let localIndex = null;

// --- Rate limiting ---
const MAX_QUERY_LENGTH = 500;
const MAX_REQUESTS_PER_DAY = 25;
const rateLimitMap = new Map();

function getRateLimitInfo(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetTime) {
    entry = { count: 0, resetTime: now + 24 * 60 * 60 * 1000 };
    rateLimitMap.set(ip, entry);
  }
  return entry;
}

function checkRateLimit(ip) {
  const entry = getRateLimitInfo(ip);
  if (entry.count >= MAX_REQUESTS_PER_DAY) return false;
  entry.count++;
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
}

const {OpenAI} = require('openai');

const keyPath = path.join(__dirname, '..', 'data', 'openai.key');
const OPENAI_API_KEY = fs.readFileSync(keyPath, 'utf8').trim();

const distribution = require('../distribution.js')({ip: '127.0.0.1', port: DIST_PORT});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256;

const {
  FILTER_FIELDS,
  VALID_OPS,
  validateFilters,
  matchesCondition,
  sectionMatchesAll,
  applyFilters,
  getFaissK,
  buildDepartmentPriorityFilterStages,
  mergeStageResults,
  rewriteDepartmentProgramFilters,
  augmentDepartmentFilters,
} = require('./filters.js');

let allKeys = [];
let totalDocs = 0;
let openaiClient = null;

function normalizeSpaces(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function ensureSemanticCoverage(originalQuery, rewordedQuery, preservedTokens = []) {
  const base = normalizeSpaces(rewordedQuery);
  const lowerBase = ` ${base.toLowerCase()} `;

  const missingTokens = preservedTokens
    .map((t) => normalizeSpaces(t))
    .filter(Boolean)
    .filter((t) => !lowerBase.includes(` ${t.toLowerCase()} `));

  if (missingTokens.length === 0) return base || normalizeSpaces(originalQuery);
  return normalizeSpaces(`${missingTokens.join(' ')} ${base}`);
}


function loadFile(filePath) {
  try {
    let text = fs.readFileSync(filePath, 'utf8').trim();
    return text;
  } catch (err) {
    throw new Error(`Failed to load file at ${filePath}: ${err.message || err}`);
  }
}

function getQueryVector(queryStr, rewordedQuery, filters) {
  /* 
  Get the Query Vector.
  */
  const semantic = normalizeSpaces(rewordedQuery);
  if (!semantic && Array.isArray(filters) && filters.length > 0) {
    // neutral vector.
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }
  const embedStr = semantic || queryStr;
  return embedQueryFaiss(embedStr);
}

const preQueryPrompt = loadFile(path.join(__dirname, 'prompts/pre_query.txt'));

//Pre-Query LLM filter.
async function preQueryReword(queryStr) {
  try {
    const client = getOpenAIClient();
    const res = await client.chat.completions.create({
      model: 'gpt-5.4-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: preQueryPrompt,
        },
        {
          role: 'user',
          content: `ACTUAL_USER_QUERY_TEXT (verbatim):\n${queryStr}`,
        },
      ],
    });

    const parsed = JSON.parse(res.choices[0].message.content);
    const validatedFilters = validateFilters(parsed.filters || []);
    const normalizedFilters = validateFilters(rewriteDepartmentProgramFilters(validatedFilters));
    const instructorIntent = false;
    const removedInstrTokens = instructorIntent
      ? []
      : normalizedFilters
        .filter((f) => f.field === 'instr' && typeof f.value === 'string')
        .map((f) => f.value);

    const baseFilters = instructorIntent
      ? normalizedFilters
      : normalizedFilters.filter((f) => f.field !== 'instr');

    const filters = validateFilters(augmentDepartmentFilters(baseFilters, queryStr));

    const rawRewordedQuery = typeof parsed.rewordedQuery === 'string' ? parsed.rewordedQuery : queryStr;

    const rewordedQuery = ensureSemanticCoverage(queryStr, rawRewordedQuery, removedInstrTokens);

    console.log('[preQueryReword] filters:', JSON.stringify(filters), 'reworded:', rewordedQuery);

    return { filters, rewordedQuery };
  } catch (err) {
    console.warn('[preQueryReword] LLM call failed, falling back:', err.message || err);
    return { filters: [], rewordedQuery: queryStr };
  }
}

// startup
function startDistributionNode(cb) {
  distribution.node.start(() => {
    console.log(`Distribution node started on port ${DIST_PORT}`);
    cb();
  });
}

function setupGroup(cb) {
  const id = distribution.util.id;
  const node = distribution.node.config;
  const group = {};
  group[id.getSID(node)] = node;
  distribution.local.groups.put({gid: GID}, group, (e) => {
    if (e) return cb(e);
    console.log(`Group '${GID}' created`);
    cb();
  });
}

async function loadIndex(cb) {
  console.log('Running indexer...');
  const { index } = await runIndexer(distribution, GID);
  allKeys = Object.keys(index);
  totalDocs = allKeys.length;
  console.log(`Index has ${totalDocs} unique courses.`);

  const faissService = {
    buildFaiss: function(gid, keys, cb) {
      console.log('buildFaiss called!', gid, 'keys:', keys.length);
      const records = [];
      let pending = keys.length;
      if (pending === 0) return cb(null, { built: 0 });
      keys.forEach((key) => {
        globalThis.distribution.local.store.get({ key, gid }, (err, record) => {
          if (!err && record) records.push(record);
          pending--;
          if (pending === 0) {
            globalThis.__buildLocalFaiss(records);
            console.log(`Built local FAISS with ${records.length} courses.`);
            cb(null, { built: records.length });
          }
        });
      });
    },
  };

  distribution[GID].routes.put(faissService, 'faiss', (err, val) => {
    console.log('routes.put callback fired, err:', err, 'val:', val);
    if (err && Object.values(err).length > 0) return cb(err);
    console.log('sending buildFaiss to all nodes...');
    distribution[GID].comm.send([GID, allKeys], { service: 'faiss', method: 'buildFaiss' }, (err, results) => {
      if (err && Object.values(err).some(Boolean)) return cb(err);
      console.log('All nodes built local FAISS:', results);
      cb();
    });
  });
}

async function loadIndexLocal(cb) {
  console.log('Running indexer (local mode — no distribution)...');
  const courseMap = await buildCourseMap();
  const index = await buildIndex(courseMap);
  localIndex = index;
  allKeys = Object.keys(index);
  totalDocs = allKeys.length;
  console.log(`Index has ${totalDocs} unique courses.`);
  const records = Object.values(index);
  buildLocalFaiss(records);
  console.log('Local FAISS index built.');
  cb();
}

function searchFaissLocal(queryVec, filters, t0, cb) {
  const topK = 40;
  const hasFilters = filters.length > 0;

  // 1. Unfiltered search (broad, over whole index)
  const unfilteredResults = localSearch(queryVec, topK);
  const unfilteredFull = unfilteredResults.map(({ code, score }) => ({
    ...localIndex[code],
    score,
  }));

  if (!hasFilters) {
    return cb(null, {
      filteredResults: unfilteredFull.slice(0, topK),
      unfilteredResults: unfilteredFull.slice(0, topK),
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'faiss-local',
      filters,
    });
  }

  const departmentStages = buildDepartmentPriorityFilterStages(filters);
  if (departmentStages) {
    const stagedFiltered = departmentStages.map((stageFilters) => {
      const stageK = getFaissK(topK, stageFilters);
      return localSearchFiltered(queryVec, stageK, stageFilters);
    });

    const prioritizedFiltered = mergeStageResults(stagedFiltered, topK);
    const filteredFull = prioritizedFiltered.map(({ code, score }) => ({
      ...localIndex[code],
      score,
    }));
    const filteredSectioned = applyFilters(filteredFull, departmentStages[0]);

    console.log(`[local] dept-priority stages: ${departmentStages.length}, returned: ${filteredSectioned.length}`);

    return cb(null, {
      filteredResults: filteredSectioned.slice(0, topK),
      unfilteredResults: unfilteredFull.slice(0, topK),
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'faiss-local',
      filters,
    });
  }

  // 2. Filtered search (restricted index)
  const faissK = getFaissK(topK, filters);
  const filteredResults = localSearchFiltered(queryVec, faissK, filters);

  console.log(`[local] unfiltered: ${unfilteredResults.length}, filtered: ${filteredResults.length}, filters: ${JSON.stringify(filters)}`);

  const filteredFull = filteredResults.map(({ code, score }) => ({
    ...localIndex[code],
    score,
  }));
  const filteredSectioned = applyFilters(filteredFull, filters);

  cb(null, {
    filteredResults: filteredSectioned.slice(0, topK),
    unfilteredResults: unfilteredFull.slice(0, topK),
    time_ms: Date.now() - t0,
    total_docs: totalDocs,
    mode: 'faiss-local',
    filters,
  });
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({apiKey: OPENAI_API_KEY});
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

function _distFaissSearch(queryVec, k, filters, searchId, cb) {
  const queryVecJson = JSON.stringify(queryVec);
  const filtersJson = JSON.stringify(filters || []);
  const hasFilters = filters && filters.length > 0;

  const map = new Function('key', 'value', `
    var sid = '__faiss_${searchId}';
    if (globalThis[sid]) return [];
    globalThis[sid] = true;

    var filters = ${filtersJson};
    var hasFilters = ${hasFilters ? 'true' : 'false'};

    var searchFn = hasFilters && typeof globalThis.__localFaissSearchFiltered === 'function'
      ? globalThis.__localFaissSearchFiltered
      : globalThis.__localFaissSearch;

    if (typeof searchFn !== 'function') {
      throw new Error('FAISS search function not ready — buildFaiss may not have run');
    }

    var queryVector = ${queryVecJson};
    var results = hasFilters
      ? searchFn(queryVector, ${k}, filters)
      : searchFn(queryVector, ${k});

    return results.map(function(r) {
      var o = {};
      o['results'] = r;
      return o;
    });
  `);

  const reduce = (_, values) => {
    const out = {};
    out['results'] = values;
    return out;
  };

  distribution[GID].mr.exec({ keys: allKeys, map, reduce }, (err, results) => {
    if (err) return cb(err);

    const docs = [];
    for (const item of results) {
      if (item['results']) {
        const v = item['results'];
        if (Array.isArray(v)) docs.push(...v);
        else docs.push(v);
      }
    }

    const seen = new Set();
    const merged = docs
      .sort((a, b) => b.score - a.score)
      .filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      })
      .slice(0, k);

    cb(null, merged);
  });
}

function _hydrateResults(codes, cb) {
  if (codes.length === 0) return cb(null, []);
  let pending = codes.length;
  const fullResults = [];
  let errored = false;

  codes.forEach(({ code, score }) => {
    distribution[GID].store.get(code, (err, record) => {
      if (errored) return;
      if (err) { errored = true; return cb(err); }
      fullResults.push({ ...record, score });
      pending--;
      if (pending === 0) cb(null, fullResults);
    });
  });
}

function searchFaiss(queryVec, filters, t0, cb) {
  const topK = 40;
  const hasFilters = filters.length > 0;
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2);

  // 1. Unfiltered search
  _distFaissSearch(queryVec, topK, [], `${ts}_unf_${rnd}`, (err, unfilteredMerged) => {
    if (err) return cb(err);

    _hydrateResults(unfilteredMerged, (err, unfilteredFull) => {
      if (err) return cb(err);

      if (!hasFilters) {
        return cb(null, {
          filteredResults: unfilteredFull.slice(0, topK),
          unfilteredResults: unfilteredFull.slice(0, topK),
          time_ms: Date.now() - t0,
          total_docs: totalDocs,
          mode: 'faiss',
          filters,
        });
      }

      const departmentStages = buildDepartmentPriorityFilterStages(filters);
      if (departmentStages) {
        const stagedMerged = [];

        function finalizeDepartmentStages() {
          const prioritizedMerged = mergeStageResults(stagedMerged, topK);
          _hydrateResults(prioritizedMerged, (hydrateErr, filteredFull) => {
            if (hydrateErr) return cb(hydrateErr);

            const filteredSectioned = applyFilters(filteredFull, departmentStages[0]);

            console.log(`[dist] dept-priority stages: ${departmentStages.length}, returned: ${filteredSectioned.length}, unfiltered: ${unfilteredFull.length}`);

            cb(null, {
              filteredResults: filteredSectioned.slice(0, topK),
              unfilteredResults: unfilteredFull.slice(0, topK),
              time_ms: Date.now() - t0,
              total_docs: totalDocs,
              mode: 'faiss',
              filters,
            });
          });
        }

        function runDepartmentStage(idx) {
          if (idx >= departmentStages.length) return finalizeDepartmentStages();

          const stageFilters = departmentStages[idx];
          const stageK = getFaissK(topK, stageFilters);
          _distFaissSearch(queryVec, stageK, stageFilters, `${ts}_dep_${idx}_${rnd}`, (stageErr, stageMerged) => {
            if (stageErr) return cb(stageErr);
            stagedMerged.push(stageMerged || []);

            if (mergeStageResults(stagedMerged, topK).length >= topK) {
              return finalizeDepartmentStages();
            }

            return runDepartmentStage(idx + 1);
          });
        }

        return runDepartmentStage(0);
      }

      // 2. Filtered search
      const faissK = getFaissK(topK, filters);
      _distFaissSearch(queryVec, faissK, filters, `${ts}_fil_${rnd}`, (err, filteredMerged) => {
        if (err) return cb(err);

        _hydrateResults(filteredMerged, (err, filteredFull) => {
          if (err) return cb(err);

          const filteredSectioned = applyFilters(filteredFull, filters);

          console.log(`[dist] filtered: ${filteredSectioned.length}, unfiltered: ${unfilteredFull.length}`);

          cb(null, {
            filteredResults: filteredSectioned.slice(0, topK),
            unfilteredResults: unfilteredFull.slice(0, topK),
            time_ms: Date.now() - t0,
            total_docs: totalDocs,
            mode: 'faiss',
            filters,
          });
        });
      });
    });
  });
}

async function search(queryStr, cb) {
  const t0 = Date.now();
  const faissSearchFn = LOCAL_MODE ? searchFaissLocal : searchFaiss;

  try {
    const { filters, rewordedQuery } = await preQueryReword(queryStr);
    console.log(`[search] original: "${queryStr}" → reworded: "${rewordedQuery}" | filters: ${JSON.stringify(filters)}`);
    const queryVec = await getQueryVector(queryStr, rewordedQuery, filters);

    faissSearchFn(queryVec, filters, t0, async (err, faissResult) => {
      if (err) return cb(err);
      try {
        const {answer, cited_courses} = await generateRAGResponse(
          getOpenAIClient(),
          rewordedQuery || queryStr,
          faissResult.filteredResults,
          faissResult.unfilteredResults,
        );
        cb(null, {
          answer,
          cited_courses,
          filteredResults: faissResult.filteredResults,
          unfilteredResults: faissResult.unfilteredResults,
          time_ms: Date.now() - t0,
          total_docs: faissResult.total_docs,
          mode: 'faiss+rag',
          filters: faissResult.filters,
        });
      } catch (ragErr) {
        console.warn('RAG generation failed, returning FAISS results only:', ragErr.message);
        cb(null, faissResult);
      }
    });
  } catch (err) {
    console.error('Search failed:', err.message || err);
    cb(err);
  }
}

// --- HTTP server ---
function startHTTPServer() {
  const htmlPath = path.join(__dirname, 'search.html');

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(fs.readFileSync(htmlPath, 'utf8'));
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/images/')) {
      const filePath = path.join(__dirname, req.url);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {'.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'};
        res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }

    if (req.method === 'POST' && req.url === '/search') {
      const clientIP = getClientIP(req);
      if (!checkRateLimit(clientIP)) {
        res.writeHead(429, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Daily request limit reached. Please try again tomorrow.'}));
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const {query} = JSON.parse(body);
          if (!query || typeof query !== 'string') {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Missing query string'}));
            return;
          }
          if (query.length > MAX_QUERY_LENGTH) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: `Query too long (max ${MAX_QUERY_LENGTH} characters).`}));
            return;
          }
          search(query, (err, result) => {
            if (err) {
              console.error('Search error:', err);
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({error: err.message}));
              return;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(result));
          });
        } catch (e) {
          res.writeHead(400, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({error: 'Invalid JSON body'}));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Search UI at http://localhost:${HTTP_PORT}`);
  });
}

// --- Exports for search-server-distributed.js ---
module.exports = {
  MAX_QUERY_LENGTH,
  MAX_REQUESTS_PER_DAY,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  FILTER_FIELDS,
  VALID_OPS,
  validateFilters,
  matchesCondition,
  sectionMatchesAll,
  getFaissK,
  getQueryVector,
  applyFilters,
  preQueryReword,
  getClientIP,
  getRateLimitInfo,
  checkRateLimit,
};

// --- Startup sequence ---
if (require.main === module) {
  if (LOCAL_MODE) {
    console.log('Starting in LOCAL mode (--local flag detected)');
    loadIndexLocal((e) => {
      if (e) {
        console.error('Course loading failed:', e);
        process.exit(1);
      }
      startHTTPServer();
    });
  } else {
    startDistributionNode(() => {
      setupGroup((e) => {
        if (e) {
          console.error('Group setup failed:', e);
          process.exit(1);
        }
        loadIndex((e) => {
          if (e && Object.values(e).length > 0) {
            console.error('Course loading failed:', e);
            process.exit(1);
          }
          startHTTPServer();
        });
      });
    });
  }
}