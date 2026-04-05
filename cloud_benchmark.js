const distribution = require('./distribution.js')();
const crypto = require('crypto');

function parseFlag(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function parseNodes(nodesStr) {
  if (!nodesStr) throw new Error('Missing --nodes=ip:port,ip:port,ip:port');
  return nodesStr.split(',').map((s) => {
    const [ip, portStr] = s.split(':');
    const port = Number(portStr);
    if (!ip || !Number.isFinite(port)) throw new Error(`Bad node entry: ${s}`);
    return { ip, port };
  });
}

function randKey(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex'); 
}

function randValue() {
  return {
    tag: randKey(4),
    score: Math.floor(Math.random() * 1e9),
    meta: { a: randKey(3), b: randKey(3) },
    arr: [Math.random(), Math.random(), Math.random()],
  };
}

function summarize(label, latenciesMs, totalMs) {
  const xs = [...latenciesMs].sort((a, b) => a - b);
  const sum = xs.reduce((acc, v) => acc + v, 0);
  const avg = sum / xs.length;
  const p50 = xs[Math.floor(0.50 * (xs.length - 1))];
  const p95 = xs[Math.floor(0.95 * (xs.length - 1))];
  const p99 = xs[Math.floor(0.99 * (xs.length - 1))];
  const throughput = xs.length / (totalMs / 1000);

  console.log(`\n=== ${label.toUpperCase()} ===`);
  console.log(`count=${xs.length}`);
  console.log(`total_ms=${totalMs.toFixed(1)}`);
  console.log(`throughput_ops_per_sec=${throughput.toFixed(2)}`);
  console.log(
    `latency_ms: avg=${avg.toFixed(2)} p50=${p50.toFixed(2)} p95=${p95.toFixed(2)} p99=${p99.toFixed(2)} min=${xs[0].toFixed(2)} max=${xs[xs.length - 1].toFixed(2)}`
  );
}

async function main() {
  const gid = parseFlag('gid', 'benchmark');
  const hashName = parseFlag('hash', 'naive');
  const n = Number(parseFlag('n', '1000'));
  const nodes = parseNodes(parseFlag('nodes', null));

  const id = distribution.util.id;
  const hash =
    hashName === 'naive' ? id.naiveHash :
    hashName === 'consistent' ? id.consistentHash :
    hashName === 'rendezvous' ? id.rendezvousHash :
    null;

  if (!hash) throw new Error('--hash must be naive, consistent, or rendezvous');
  if (!Number.isFinite(n) || n <= 0) throw new Error('--n must be a positive integer');

  console.log(`[config] gid=${gid} hash=${hashName} n=${n}`);
  console.log(`[config] nodes=${nodes.map((x) => `${x.ip}:${x.port}`).join(', ')}`);

  await new Promise((resolve, reject) => {
    distribution.node.start((err) => (err ? reject(err) : resolve()));
  });

  const group = {};
  for (const node of nodes) group[id.getSID(node)] = node;

  await new Promise((resolve, reject) => {
    distribution.local.groups.put({ gid, hash }, group, (e) => (e ? reject(e) : resolve()));
  });

  console.log(`[stage 1] generating ${n} pairs...`);
  const pairs = Array.from({ length: n }, () => ({ key: randKey(8), value: randValue() }));

  console.log(`[stage 2] putting ${n} values...`);
  const putLat = [];
  const putStart = process.hrtime.bigint();

  for (let i = 0; i < pairs.length; i++) {
    const { key, value } = pairs[i];
    const t0 = process.hrtime.bigint();

    await new Promise((resolve, reject) => {
      distribution[gid].store.put(value, key, (e) => (e ? reject(e) : resolve()));
    });

    const t1 = process.hrtime.bigint();
    putLat.push(Number(t1 - t0) / 1e6);

    if ((i + 1) % 100 === 0) console.log(`  put progress ${i + 1}/${n}`);
  }

  const putTotal = Number(process.hrtime.bigint() - putStart) / 1e6;
  summarize('put', putLat, putTotal);

  console.log(`[stage 3] getting ${n} values...`);
  const getLat = [];
  const getStart = process.hrtime.bigint();

  for (let i = 0; i < pairs.length; i++) {
    const { key, value } = pairs[i];
    const t0 = process.hrtime.bigint();

    const got = await new Promise((resolve, reject) => {
      distribution[gid].store.get(key, (e, v) => (e ? reject(e) : resolve(v)));
    });

    const t1 = process.hrtime.bigint();
    getLat.push(Number(t1 - t0) / 1e6);

    if (JSON.stringify(got) !== JSON.stringify(value)) {
      throw new Error(`Value mismatch for key=${key}`);
    }

    if ((i + 1) % 100 === 0) console.log(`  get progress ${i + 1}/${n}`);
  }

  const getTotal = Number(process.hrtime.bigint() - getStart) / 1e6;
  summarize('get', getLat, getTotal);

  if (globalThis.distribution?.node?.server) {
    globalThis.distribution.node.server.close();
  }
}

main().catch((e) => {
  console.error('Benchmark error:', e.message);
  process.exitCode = 1;
  if (globalThis.distribution?.node?.server) globalThis.distribution.node.server.close();
});