#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const { generateRAGResponse } = require('../scripts/rag.js');
const {
  validateFilters,
  rewriteDepartmentProgramFilters,
  augmentDepartmentFilters,
} = require('./filters.js');
const {
  logQuery,
  getClientIP,
  checkRateLimit,
  cacheKey,
  cacheGet,
  cachePut,
  inFlight,
  runWithLimit,
  MAX_QUERY_LENGTH,
} = require('./cache.js');
const { loadIndexLocal, searchFaissLocal } = require('./localSearch.js');
const { detectConcentration, loadConcentrationContext, getConcentrationName, getConcentrationData } = require('./concentrations.js');

const HTTP_PORT = 3000;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256;

const keyPath = path.join(__dirname, '..', 'data', 'openai.key');
const OPENAI_API_KEY = fs.readFileSync(keyPath, 'utf8').trim();

let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
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

function normalizeSpaces(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

//reinjects tokens which the pre-query LLM stripped out.
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

const preQueryPrompt = fs.readFileSync(path.join(__dirname, 'prompts/pre_query.txt'), 'utf8').trim();

async function preQueryReword(queryStr) {
  try {
    const client = getOpenAIClient();
    const res = await client.chat.completions.create({
      model: 'gpt-5.4-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: preQueryPrompt },
        { role: 'user', content: `ACTUAL_USER_QUERY_TEXT (verbatim):\n${queryStr}` },
      ],
    });

    const parsed = JSON.parse(res.choices[0].message.content);
    const validatedFilters = validateFilters(parsed.filters || []);
    const normalizedFilters = validateFilters(rewriteDepartmentProgramFilters(validatedFilters));
    const removedInstrTokens = normalizedFilters
      .filter((f) => f.field === 'instr' && typeof f.value === 'string')
      .map((f) => f.value);
    const baseFilters = normalizedFilters.filter((f) => f.field !== 'instr');
    const filters = validateFilters(augmentDepartmentFilters(baseFilters, queryStr));
    const rawReworded = typeof parsed.rewordedQuery === 'string' ? parsed.rewordedQuery : queryStr;
    const rewordedQuery = ensureSemanticCoverage(queryStr, rawReworded, removedInstrTokens);

    console.log('[preQueryReword] filters:', JSON.stringify(filters), 'reworded:', rewordedQuery);
    return { filters, rewordedQuery };
  } catch (err) {
    console.warn('[preQueryReword] LLM call failed, falling back:', err.message || err);
    return { filters: [], rewordedQuery: queryStr };
  }
}

async function getQueryVector(queryStr, rewordedQuery, filters) {
  const semantic = normalizeSpaces(rewordedQuery);
  if (!semantic && Array.isArray(filters) && filters.length > 0) {
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }
  return embedQueryFaiss(semantic || queryStr);
}

async function search(queryStr, cb, userFilters = []) {
  const t0 = Date.now();
  const timing = {};
  const faissSearchFn = searchFaissLocal;

  try {
    const tPreQuery = Date.now();
    const { filters: llmFilters, rewordedQuery } = await preQueryReword(queryStr);
    const filters = [...llmFilters, ...userFilters];
    timing.prequery_ms = Date.now() - tPreQuery;

    const concentrationSlug = detectConcentration(queryStr);
    const concentrationContext = concentrationSlug ? loadConcentrationContext(concentrationSlug) : null;
    if (concentrationSlug) console.log(`[search] concentration detected: ${concentrationSlug}`);

    console.log(`[search] original: "${queryStr}" → reworded: "${rewordedQuery}" | filters: ${JSON.stringify(filters)}`);

    const tEmbed = Date.now();
    const queryVec = await getQueryVector(queryStr, rewordedQuery, filters);
    timing.embedding_ms = Date.now() - tEmbed;

    const tFaiss = Date.now();
    faissSearchFn(queryVec, filters, t0, async (err, faissResult) => {
      timing.faiss_ms = Date.now() - tFaiss;
      if (err) return cb(err);
      try {
        const tRag = Date.now();
        const { answer, cited_courses } = await generateRAGResponse(
          getOpenAIClient(),
          queryStr,
          faissResult.filteredResults,
          faissResult.unfilteredResults,
          faissResult.partialMatches || [],
          faissResult.unmatchedFilters || [],
          concentrationContext,
        );
        timing.rag_ms = Date.now() - tRag;
        timing.total_ms = Date.now() - t0;

        cb(null, {
          answer,
          cited_courses,
          filteredResults: faissResult.filteredResults,
          unfilteredResults: faissResult.unfilteredResults,
          time_ms: timing.total_ms,
          timing,
          total_docs: faissResult.total_docs,
          mode: 'faiss+rag',
          filters: faissResult.filters,
          ...(concentrationSlug && { concentration: getConcentrationData(concentrationSlug) }),
        });
      } catch (ragErr) {
        console.warn('RAG generation failed, returning FAISS results only:', ragErr.message);
        timing.total_ms = Date.now() - t0;
        cb(null, { ...faissResult, timing });
      }
    });
  } catch (err) {
    console.error('Search failed:', err.message || err);
    cb(err);
  }
}

// --- HTTP server ---
function startHTTPServer() {
  const server = http.createServer((req, res) => {
    req.on('error', () => {});
    res.on('error', () => {});

    if (req.method === 'POST' && req.url === '/search') {
      const clientIP = getClientIP(req);
      if (!checkRateLimit(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Daily request limit reached. Please try again tomorrow.' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk.toString(); });
      req.on('end', () => {
        if (res.writableEnded) return;
        try {
          const { query, fallOnly } = JSON.parse(body);
          const userFilters = fallOnly ? [
            { field: 'season', op: 'eq', value: 'Fall' },
            { field: 'year', op: 'eq', value: 2026 },
          ] : [];

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

          const sendResult = (result, fromCache) => {
            if (res.writableEnded) return;
            logQuery(query, {
              fallOnly,
              filters: result.filters,
              reworded: result.reworded,
              time_ms: result.time_ms,
              cached: fromCache,
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(fromCache ? { ...result, cached: true } : result));
          };

          const sendError = (err) => {
            if (res.writableEnded) return;
            logQuery(query, { fallOnly, error: err.message || String(err) });
            console.error('Search error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Search failed. Please try again.' }));
          };

          const cacheQuery = fallOnly ? query + '::fallOnly' : query;
          const key = cacheKey(cacheQuery);
          const cached = cacheGet(cacheQuery);
          if (cached) { sendResult(cached, true); return; }

          if (inFlight.has(key)) {
            inFlight.get(key).then((r) => sendResult(r, true)).catch(sendError);
            return;
          }

          const promise = runWithLimit(() => new Promise((resolve, reject) => {
            search(query, (err, result) => {
              if (err) reject(err); else resolve(result);
            }, userFilters);
          }));

          inFlight.set(key, promise);
          promise.then((result) => {
            inFlight.delete(key);
            cachePut(cacheQuery, result);
            sendResult(result, false);
          }).catch((err) => {
            inFlight.delete(key);
            sendError(err);
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

  server.keepAliveTimeout = 0;
  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Search UI at http://localhost:${HTTP_PORT}`);
  });
}

// --- Startup ---
if (require.main === module) {
  loadIndexLocal((e) => {
    if (e) { console.error('Course loading failed:', e); process.exit(1); }
    startHTTPServer();
  });
}

module.exports = {
  MAX_QUERY_LENGTH,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  getQueryVector,
  preQueryReword,
  getClientIP,
  checkRateLimit,
  getRateLimitInfo: require('./cache.js').getRateLimitInfo,
};
