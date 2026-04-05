const { execSync } = require('child_process');

const seedURL = process.argv[2];

if (!seedURL) {
  console.error('usage: node c/benchmark.js <seed-url>');
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, {
    cwd: __dirname + '/..',   // non-distribution/
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function main() {
  // reset crawler state
  run('rm -f d/visited.txt d/urls.txt');

  const startCrawl = Date.now();
  const text = run(`./crawl.sh ${seedURL}`);
  const crawlTime = (Date.now() - startCrawl) / 1000;

  const startIndex = Date.now();
  run('./index.sh');
  const indexTime = (Date.now() - startIndex) / 1000;

  const queries = ['search', 'engine', 'distributed', 'test'];
  const startQuery = Date.now();
  for (const q of queries) {
    run(`./engine.sh ${q}`);
  }
  const queryTime = (Date.now() - startQuery) / 1000;

  console.log(JSON.stringify({
    corpus: seedURL,
    throughput: {
      crawler_pages_per_sec: 1 / crawlTime,
      index_seconds: indexTime,
      query_qps: queries.length / queryTime
    }
  }, null, 2));
}

main();
