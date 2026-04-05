const distribution = require('../../distribution.js')();
const util = distribution.util;

function avg(nums) {
  let total = 0;
  for (const n of nums) total += n;
  return total / nums.length;
}

function timeOp(fn, input, reps) {
  const durationsMs = [];
  for (let r = 0; r < reps; r++) {
    const t0 = process.hrtime.bigint();
    fn(input);
    const t1 = process.hrtime.bigint();
    durationsMs.push(Number(t1 - t0) / 1e6);
  }
  return avg(durationsMs);
}

function runLatencyBenchmark() {
  const baseValues = [
    0,
    -17.25,
    'CS1380 rocks',
    '',
    true,
    false,
    null,
    undefined,
  ];

  const callableValues = [
    (x) => x * 2,
    function concat(a, b) { return String(a) + String(b); },
    function alwaysTrue() { return true; },
  ];

  const structuredValues = [
    { title: 'index', count: 7, missing: undefined },
    {
      config: {
        mode: 'fast',
        flags: [true, false, true],
        createdAt: new Date('2020-01-02T03:04:05Z'),
      },
      notes: ['alpha', 'beta', 'gamma'],
    },
    [
      { id: 1, tags: ['a', 'b'] },
      { id: 2, tags: [], meta: { ok: true, when: new Date() } },
      { id: 3, err: new Error('bad input') },
    ],
    {
      payload: Array.from({ length: 50 }, (_, i) => ({
        key: `k${i}`,
        val: i % 3 === 0 ? null : i,
        inner: { sq: i * i, even: i % 2 === 0 },
      })),
    },
  ];

  const repetitions = 1000;

  const suites = [
    ['base', baseValues],
    ['callables', callableValues],
    ['structured', structuredValues],
  ];

  const summary = {};

  for (const [suiteName, samples] of suites) {
    const serMeans = [];
    const deserMeans = [];

    for (const sample of samples) {
      // serialization latency
      serMeans.push(timeOp(util.serialize, sample, repetitions));

      // deserialization latency (use one fixed serialized string)
      const encoded = util.serialize(sample);
      deserMeans.push(timeOp(util.deserialize, encoded, repetitions));
    }

    summary[suiteName] = {
      serialize_ms: avg(serMeans),
      deserialize_ms: avg(deserMeans),
      sample_count: samples.length,
      repetitions,
    };
  }

  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  runLatencyBenchmark();
}

module.exports = { runLatencyBenchmark };
