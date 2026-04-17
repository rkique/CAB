#!/usr/bin/env node

const { runIndexer, buildCourseMap, buildIndex } = require('../scripts/indexer.js');
const { generateRAGResponse } = require('../scripts/rag.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const natural = require('natural/lib/natural/stemmers/porter_stemmer');

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

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'not', 'no', 'as', 'if', 'then', 'than',
  'so', 'up', 'out', 'about', 'into', 'over', 'after', 'before', 'between',
  'under', 'above', 'such', 'each', 'which', 'their', 'there', 'they',
  'them', 'we', 'he', 'she', 'you', 'my', 'your', 'our', 'his', 'her',
  'all', 'any', 'both', 'few', 'more', 'most', 'other', 'some', 'only',
  'own', 'same', 'also', 'just', 'very', 'well',
]);

const stem = natural.stem;

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOPWORDS.has(w));
}

function stemTokens(tokens) {
  return tokens.map((t) => stem(t));
}

const {OpenAI} = require('openai');

const keyPath = path.join(__dirname, '..', 'data', 'openai.key');
const OPENAI_API_KEY = fs.readFileSync(keyPath, 'utf8').trim();

const distribution = require('../distribution.js')({ip: '127.0.0.1', port: DIST_PORT});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256;

let allKeys = [];
let totalDocs = 0;
let openaiClient = null;

// --- helpers
function getFaissK(topK, filter = {}) {
  let multiplier = 3;
  if (filter.days?.length > 0) multiplier++;
  if (filter.season) multiplier++;
  if (filter.year) multiplier++;
  return topK * multiplier;
}

function filterSections(results, filters = {}) {
  return results
    .map((course) => {
      let sections = course.sections || [];
      if (filters.days?.length > 0) {
        sections = sections.filter((s) =>
          filters.days.every((d) => s.days.includes(d))
        );
      }
      if (filters.season) sections = sections.filter((s) => s.season === filters.season);
      if (filters.year) sections = sections.filter((s) => s.year === filters.year);
      if (filters.semester) sections = sections.filter((s) => s.semester === filters.semester);
      if (filters.noPermReq) sections = sections.filter((s) => s.permreq === 'N');
      return { ...course, sections };
    })
    .filter((course) => course.sections.length > 0);
}

function deduplicateResults(results) {
  const byTitle = {};
  for (const course of results) {
    const normalizedTitle = course.title.replace(/\s*\(.*?\)\s*$/, '').trim();
    if (!byTitle[normalizedTitle]) {
      byTitle[normalizedTitle] = { ...course, crossListings: [course.code] };
    } else {
      if (course.score > byTitle[normalizedTitle].score) {
        byTitle[normalizedTitle] = {
          ...course,
          crossListings: byTitle[normalizedTitle].crossListings,
        };
      }
      byTitle[normalizedTitle].crossListings.push(course.code);
    }
  }
  return Object.values(byTitle).sort((a, b) => b.score - a.score);
}

function parseQueryFilters(queryStr) {
  const filters = {};

  // normalize separators so "Monday, W, and Friday" → "monday w friday"
  const normalized = queryStr.toLowerCase()
    .replace(/\band\b/g, ' ')
    .replace(/[,;\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const days = new Set();

  // shorthands first
  if (normalized.match(/\bmwf\b/)) { days.add('M'); days.add('W'); days.add('F'); }
  if (normalized.match(/\b(tuth|tth)\b/)) { days.add('Tu'); days.add('Th'); }
  if (normalized.match(/\bmw\b/)) { days.add('M'); days.add('W'); }

  // full names
  if (normalized.match(/\bmonday\b|\bmon\b/)) days.add('M');
  if (normalized.match(/\btuesday\b|\btues\b|\btue\b/)) days.add('Tu');
  if (normalized.match(/\bwednesday\b|\bwed\b/)) days.add('W');
  if (normalized.match(/\bthursday\b|\bthurs\b|\bthu\b/)) days.add('Th');
  if (normalized.match(/\bfriday\b|\bfri\b/)) days.add('F');

  // single letters — Th before T, careful with standalone letters
  if (normalized.match(/\bth\b/)) days.add('Th');
  if (normalized.match(/\bthu\b/)) days.add('Th');
  if (normalized.match(/\btu\b/)) days.add('Tu');
  if (normalized.match(/(?<![a-s,u-z])m\b/)) days.add('M');
  if (normalized.match(/\bw\b/)) days.add('W');
  if (normalized.match(/\bf\b/)) days.add('F');

  if (days.size > 0) filters.days = [...days];

  // season
  if (normalized.includes('fall')) filters.season = 'Fall';
  else if (normalized.includes('spring')) filters.season = 'Spring';
  else if (normalized.includes('summer')) filters.season = 'Summer';
  else if (normalized.includes('winter')) filters.season = 'Winter';

  // year
  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  if (yearMatch) filters.year = parseInt(yearMatch[1]);

  // no permission required
  if (normalized.match(/\bno perm|\bno permission|\bopen enroll/)) {
    filters.noPermReq = true;
  }

  return filters;
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

function searchFaissLocal(queryVec, queryStr, t0, cb) {
  const topK = 40;
  const filters = parseQueryFilters(queryStr);
  const faissK = getFaissK(topK, filters);
  const hasFilters = filters.days || filters.season || filters.year;

  // use filtered search if filters are present
  const results = hasFilters
    ? localSearchFiltered(queryVec, faissK, filters)
    : localSearch(queryVec, faissK);

  console.log(`[local] FAISS returned ${results.length} results, filters:`, filters);

  if (results.length === 0) {
    return cb(null, {
      results: [],
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'faiss-local',
      filters,
    });
  }

  const fullResults = results.map(({ code, score }) => ({
    ...localIndex[code],
    score,
  }));

  const filtered = filterSections(fullResults, filters);
  const deduped = deduplicateResults(filtered);
  const ranked = deduped.sort((a, b) => b.score - a.score).slice(0, topK);

  cb(null, {
    results: ranked,
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

function searchFaiss(queryVec, queryStr, t0, cb) {
  const topK = 40;
  const filters = parseQueryFilters(queryStr);
  const faissK = getFaissK(topK, filters);
  const queryVecJson = JSON.stringify(queryVec);
  const filtersJson = JSON.stringify(filters);
  const hasFilters = !!(filters.days || filters.season || filters.year);
  const searchId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const map = new Function('key', 'value', `
    var sid = '__faiss_${searchId}';
    if (globalThis[sid]) return [];
    globalThis[sid] = true;

    var filters = ${filtersJson};
    var hasFilters = ${hasFilters};

    var searchFn = hasFilters && typeof globalThis.__localFaissSearchFiltered === 'function'
      ? globalThis.__localFaissSearchFiltered
      : globalThis.__localFaissSearch;

    if (typeof searchFn !== 'function') {
      throw new Error('FAISS search function not ready — buildFaiss may not have run');
    }

    var queryVector = ${queryVecJson};
    var results = hasFilters
      ? searchFn(queryVector, ${faissK}, filters)
      : searchFn(queryVector, ${faissK});

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
      .slice(0, faissK);

    if (merged.length === 0) {
      return cb(null, {
        results: [],
        time_ms: Date.now() - t0,
        total_docs: totalDocs,
        mode: 'faiss',
        filters,
      });
    }

    let pending = merged.length;
    const fullResults = [];
    let errored = false;

    merged.forEach(({ code, score }) => {
      distribution[GID].store.get(code, (err, record) => {
        if (errored) return;
        if (err) { errored = true; return cb(err); }
        fullResults.push({ ...record, score });
        pending--;
        if (pending === 0) {
          const filtered = filterSections(fullResults, filters);
          const deduped = deduplicateResults(filtered);
          const ranked = deduped.sort((a, b) => b.score - a.score).slice(0, topK);
          cb(null, {
            results: ranked,
            time_ms: Date.now() - t0,
            total_docs: totalDocs,
            mode: 'faiss',
            filters,
          });
        }
      });
    });
  });
}

function search(queryStr, cb) {
  const t0 = Date.now();
  const faissSearchFn = LOCAL_MODE ? searchFaissLocal : searchFaiss;

  embedQueryFaiss(queryStr).then((queryVec) => {
    faissSearchFn(queryVec, queryStr, t0, async (err, faissResult) => {
      if (err) return cb(err);
      try {
        const {answer, cited_courses} = await generateRAGResponse(
          getOpenAIClient(), queryStr, faissResult.results
        );
        cb(null, {
          answer,
          cited_courses,
          results: faissResult.results,
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
  STOPWORDS,
  MAX_QUERY_LENGTH,
  MAX_REQUESTS_PER_DAY,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  tokenize,
  stemTokens,
  getFaissK,
  filterSections,
  deduplicateResults,
  parseQueryFilters,
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