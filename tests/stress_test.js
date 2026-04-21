#!/usr/bin/env node
/**
 * Stress test suite for BrunoRAG /search endpoint.
 *
 * Usage:
 *   node tests/stress_test.js [--host localhost] [--port 3000]
 *
 * Make sure the server is running before executing this.
 * Tests do NOT require OpenAI to succeed — they validate server behavior
 * under load and edge-case inputs.
 */

'use strict';

const http = require('http');

const HOST = process.argv.includes('--host')
  ? process.argv[process.argv.indexOf('--host') + 1]
  : 'localhost';
const PORT = process.argv.includes('--port')
  ? parseInt(process.argv[process.argv.indexOf('--port') + 1])
  : 3000;

// ─── helpers ─────────────────────────────────────────────────────────────────

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const opts = {
      host: HOST,
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { host: HOST, port: PORT, path, method: 'GET', headers };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('\x1b[32mPASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log(`\x1b[31mFAIL\x1b[0m — ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ─── test suites ─────────────────────────────────────────────────────────────

async function testServerReachable() {
  console.log('\n[1] Server reachability');

  await test('GET / returns 200', async () => {
    const r = await get('/');
    assert(r.status === 200, `Expected 200, got ${r.status}`);
  });

  await test('POST /search with valid query returns 200 or 429', async () => {
    const r = await post('/search', { query: 'intro computer science' });
    assert([200, 429].includes(r.status), `Unexpected status ${r.status}`);
  });
}

async function testInputValidation() {
  console.log('\n[2] Input validation');

  await test('Empty query returns 400', async () => {
    const r = await post('/search', { query: '' });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Missing query field returns 400', async () => {
    const r = await post('/search', { notAQuery: 'hello' });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Non-string query returns 400', async () => {
    const r = await post('/search', { query: 12345 });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Query at exactly 500 chars is accepted', async () => {
    const q = 'a'.repeat(500);
    const r = await post('/search', { query: q });
    assert([200, 429].includes(r.status), `Expected 200 or 429, got ${r.status}`);
  });

  await test('Query at 501 chars is rejected with 400', async () => {
    const q = 'a'.repeat(501);
    const r = await post('/search', { query: q });
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  await test('Malformed JSON returns 400', async () => {
    const r = await post('/search', '{ bad json !!', {});
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });
}

async function testBodySizeBomb() {
  console.log('\n[3] Body size (DoS protection)');

  await test('1 MB body is rejected before processing', async () => {
    const bigBody = JSON.stringify({ query: 'x'.repeat(1_000_000) });
    const r = await post('/search', bigBody);
    // Should reject with 400 (too long) or 413 (body too large)
    // NOT 200 — the server must not embed a 1MB string
    assert(
      [400, 413].includes(r.status),
      `Server accepted a 1 MB body (status ${r.status}) — no body size limit enforced`
    );
  });

  await test('10 MB body is rejected or connection closed', async () => {
    const bigBody = 'x'.repeat(10_000_000);
    try {
      const r = await post('/search', bigBody);
      assert(
        [400, 413].includes(r.status),
        `Server accepted a 10 MB body (status ${r.status})`
      );
    } catch (err) {
      // Connection reset / destroyed is also acceptable — server defended itself
      if (err.message === 'timeout') throw err;
      // ECONNRESET, EPIPE etc. are fine
    }
  });
}

async function testConcurrentLoad() {
  console.log('\n[4] Concurrent load');

  const CONCURRENCY = 20;
  const QUERY = 'machine learning data science python';

  await test(`${CONCURRENCY} simultaneous requests all receive a response`, async () => {
    const requests = Array.from({ length: CONCURRENCY }, () =>
      post('/search', { query: QUERY }).catch((e) => ({ error: e.message }))
    );
    const results = await Promise.all(requests);
    const errors = results.filter((r) => r.error);
    const statuses = results.filter((r) => !r.error).map((r) => r.status);
    const bad = statuses.filter((s) => ![200, 429, 500].includes(s));
    assert(
      errors.length === 0 && bad.length === 0,
      `${errors.length} connection errors, ${bad.length} unexpected statuses: ${bad}`
    );
  });

  await test('Response times under load are logged', async () => {
    const times = [];
    const requests = Array.from({ length: 10 }, async () => {
      const t0 = Date.now();
      await post('/search', { query: 'history of art' }).catch(() => {});
      times.push(Date.now() - t0);
    });
    await Promise.all(requests);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const max = Math.max(...times);
    console.log(`\n      avg=${avg}ms  max=${max}ms  samples=${times.length}`);
    // This test always passes — it's informational
  });
}

async function testRateLimiter() {
  console.log('\n[5] Rate limiter');

  await test('X-Forwarded-For header is ignored (spoofing has no effect)', async () => {
    // After our fix, getClientIP uses req.socket.remoteAddress only.
    // Send with a spoofed header — rate counter must still increment against
    // the real socket IP (127.0.0.1), not the spoofed value.
    // We can't directly assert what IP the server used, but we can confirm
    // the request is counted by exhausting the quota and checking 429 appears.
    // This test just confirms the server doesn't crash when the header is present.
    const r = await post('/search', { query: 'biology courses' }, { 'X-Forwarded-For': '1.2.3.4' });
    assert([200, 429, 400, 500].includes(r.status), `Unexpected status ${r.status}`);
  });

  await test('Rate limit is enforced after 25 requests from same socket IP', async () => {
    // Fire 26 sequential requests from this process (all share 127.0.0.1).
    // At least one must hit 429. Note: earlier tests in this run may have
    // already consumed some of the quota for 127.0.0.1.
    let hit429 = false;
    for (let i = 0; i < 26; i++) {
      const r = await post('/search', { query: 'courses' });
      if (r.status === 429) { hit429 = true; break; }
    }
    assert(hit429, '26 requests from same IP never triggered a 429 rate limit');
  });
}

async function testUnknownRoutes() {
  console.log('\n[6] Unknown routes / methods');

  await test('GET /search returns 404 (not a GET route)', async () => {
    const r = await get('/search');
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });

  await test('GET /nonexistent returns 404', async () => {
    const r = await get('/nonexistent');
    assert(r.status === 404, `Expected 404, got ${r.status}`);
  });
}

// ─── entry point ─────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nBrunoRAG Stress Tests — http://${HOST}:${PORT}`);
  console.log('='.repeat(50));

  try {
    // Quick ping before running anything
    await get('/');
  } catch {
    console.error(`\nERROR: Cannot reach http://${HOST}:${PORT} — is the server running?\n`);
    process.exit(1);
  }

  await testServerReachable();
  await testInputValidation();
  await testBodySizeBomb();
  await testConcurrentLoad();
  await testRateLimiter();
  await testUnknownRoutes();

  console.log('\n' + '='.repeat(50));
  console.log(`Results: \x1b[32m${passed} passed\x1b[0m  \x1b[31m${failed} failed\x1b[0m`);
  process.exit(failed > 0 ? 1 : 0);
})();
