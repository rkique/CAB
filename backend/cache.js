const fs = require('fs');

// --- Query logger ---
const QUERY_LOG_PATH = process.env.QUERY_LOG_PATH || '/var/log/brunorag/queries.log';

function logQuery(query, { fallOnly, filters, reworded, time_ms, cached, error } = {}) {
  try {
    const entry = {
      ts: new Date().toISOString(),
      query,
      fallOnly: !!fallOnly,
      ...(filters && { filters }),
      ...(reworded && { reworded }),
      ...(time_ms !== undefined && { time_ms }),
      ...(cached && { cached }),
      ...(error && { error }),
    };
    fs.appendFileSync(QUERY_LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('[query-log] failed to write:', e.message);
  }
}

console.log(`[query-log] logging to ${QUERY_LOG_PATH}`);

// --- Rate limiting ---
const MAX_QUERY_LENGTH = 500;
const MAX_REQUESTS_PER_DAY = 250;
const rateLimitMap = new Map();

function getClientIP(req) {
  return req.socket.remoteAddress;
}

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

// --- LRU cache ---
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 30 * 60 * 1000;
const searchCache = new Map();

function cacheKey(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cacheGet(query) {
  const key = cacheKey(query);
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { searchCache.delete(key); return null; }
  searchCache.delete(key);
  searchCache.set(key, entry);
  return entry.result;
}

function cachePut(query, result) {
  const key = cacheKey(query);
  if (searchCache.size >= CACHE_MAX_SIZE) {
    searchCache.delete(searchCache.keys().next().value);
  }
  searchCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// --- In-flight dedup ---
const inFlight = new Map();

// --- Concurrency limiter ---
const MAX_CONCURRENT_SEARCHES = 3;
let activeSearches = 0;
const searchQueue = [];

function runWithLimit(fn) {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeSearches++;
      fn().then(resolve, reject).finally(() => {
        activeSearches--;
        if (searchQueue.length > 0) searchQueue.shift()();
      });
    };
    if (activeSearches < MAX_CONCURRENT_SEARCHES) run();
    else searchQueue.push(run);
  });
}

module.exports = {
  QUERY_LOG_PATH,
  logQuery,
  MAX_QUERY_LENGTH,
  MAX_REQUESTS_PER_DAY,
  getClientIP,
  getRateLimitInfo,
  checkRateLimit,
  cacheKey,
  cacheGet,
  cachePut,
  inFlight,
  runWithLimit,
};
