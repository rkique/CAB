#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const {OpenAI} = require('openai');
const natural = require('natural/lib/natural/stemmers/porter_stemmer');

const CLUSTER_PATH = process.env.CLUSTER_CONFIG ?
  path.resolve(process.env.CLUSTER_CONFIG) :
  path.join(__dirname, 'cluster.json');
const ALL_KEYS_PATH = process.env.ALL_KEYS_PATH ?
  path.resolve(process.env.ALL_KEYS_PATH) :
  path.join(__dirname, 'all_keys.json');

if (!fs.existsSync(CLUSTER_PATH)) {
  console.error(`Missing cluster config: ${CLUSTER_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(ALL_KEYS_PATH)) {
  console.error(`Missing all keys file: ${ALL_KEYS_PATH}`);
  process.exit(1);
}

const cluster = JSON.parse(fs.readFileSync(CLUSTER_PATH, 'utf8'));
const allKeysDoc = JSON.parse(fs.readFileSync(ALL_KEYS_PATH, 'utf8'));
const coordinator = cluster.coordinator;
const GID = cluster.gid || 'courses';
const EMBEDDING_MODEL = cluster.embedding?.model || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = cluster.embedding?.dimensions || 256;
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

const distribution = require('./distribution.js')({
  ip: coordinator.ip,
  port: coordinator.distPort,
});

let openaiClient = null;
const allKeys = Array.isArray(allKeysDoc.keys) ? allKeysDoc.keys : [];
const totalDocs = allKeys.length;

function tokenize(text) {
  return text.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOPWORDS.has(w));
}

function stemTokens(tokens) {
  return tokens.map((t) => natural.stem(t));
}

function buildWorkerGroup() {
  const id = distribution.util.id;
  const group = {};
  for (const w of cluster.workers) {
    const node = {ip: w.ip, port: w.distPort};
    group[id.getSID(node)] = node;
  }
  return group;
}

function startDistributionNode(cb) {
  distribution.node.start((err) => {
    if (err) return cb(err);
    console.log(`Coordinator listening on ${coordinator.ip}:${coordinator.distPort}`);
    cb();
  });
}

function installGroup(cb) {
  const group = buildWorkerGroup();
  distribution.local.groups.put({gid: GID}, group, cb);
}

function getOpenAIClient() {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set.');
    }
    openaiClient = new OpenAI({apiKey: process.env.OPENAI_API_KEY});
  }
  return openaiClient;
}

async function embedQuery(queryStr) {
  const client = getOpenAIClient();
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: queryStr,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return res.data[0].embedding;
}

function searchTFIDF(queryStr, t0, cb) {
  const tokens = tokenize(queryStr);
  const queryStems = [...new Set(stemTokens(tokens))];

  if (queryStems.length === 0) {
    return cb(null, {
      results: [],
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'tfidf',
    });
  }

  const querySet = JSON.stringify(queryStems);
  const N = totalDocs;

  const map = new Function('key', 'value', `
    var queryStems = ${querySet};

    function catGroups(t){return t.replace(/[^aeiouy]+y/g,'CV').replace(/[aeiou]+/g,'V').replace(/[^V]+/g,'C')}
    function catChars(t){return t.replace(/[^aeiouy]y/g,'CV').replace(/[aeiou]/g,'V').replace(/[^V]/g,'C')}
    function meas(t){if(!t)return -1;return catGroups(t).replace(/^C/,'').replace(/V$/,'').length/2}
    function endsDbl(t){return t.match(/([^aeiou])\\1$/)}
    function attRepl(t,p,r,cb){var res=null;if(typeof p==='string'&&t.substr(0-p.length)===p)res=t.replace(new RegExp(p+'$'),r);else if(p instanceof RegExp&&t.match(p))res=t.replace(p,r);if(res&&cb)return cb(res);return res}
    function attReplPats(t,reps,mt){var rr=t;for(var i=0;i<reps.length;i++){if(mt==null||meas(attRepl(t,reps[i][0],reps[i][1]))>mt){rr=attRepl(rr,reps[i][0],reps[i][2])||rr}}return rr}
    function replPats(t,reps,mt){return attReplPats(t,reps,mt)||t}
    function replRx(t,rx,parts,mm){var p,r='';if(rx.test(t)){p=rx.exec(t);parts.forEach(function(i){r+=p[i]})}if(meas(r)>mm)return r;return null}
    function s1a(t){if(t.match(/(ss|i)es$/))return t.replace(/(ss|i)es$/,'$1');if(t.substr(-1)==='s'&&t.substr(-2,1)!=='s'&&t.length>2)return t.replace(/s?$/,'');return t}
    function s1b(t){var r;if(t.substr(-3)==='eed'){if(meas(t.substr(0,t.length-3))>0)return t.replace(/eed$/,'ee')}else{r=attRepl(t,/(ed|ing)$/,'',function(t2){if(catGroups(t2).indexOf('V')>=0){r=attReplPats(t2,[['at','','ate'],['bl','','ble'],['iz','','ize']]);if(r!==t2)return r;if(endsDbl(t2)&&t2.match(/[^lsz]$/))return t2.replace(/([^aeiou])\\1$/,'$1');if(meas(t2)===1&&catChars(t2).substr(-3)==='CVC'&&t2.match(/[^wxy]$/))return t2+'e';return t2}return null});if(r)return r}return t}
    function s1c(t){var cg=catGroups(t);if(t.substr(-1)==='y'&&cg.substr(0,cg.length-1).indexOf('V')>-1)return t.replace(/y$/,'i');return t}
    function s2(t){return replPats(t,[['ational','','ate'],['tional','','tion'],['enci','','ence'],['anci','','ance'],['izer','','ize'],['abli','','able'],['bli','','ble'],['alli','','al'],['entli','','ent'],['eli','','e'],['ousli','','ous'],['ization','','ize'],['ation','','ate'],['ator','','ate'],['alism','','al'],['iveness','','ive'],['fulness','','ful'],['ousness','','ous'],['aliti','','al'],['iviti','','ive'],['biliti','','ble'],['logi','','log']],0)}
    function s3(t){return replPats(t,[['icate','','ic'],['ative','',''],['alize','','al'],['iciti','','ic'],['ical','','ic'],['ful','',''],['ness','','']],0)}
    function s4(t){return replRx(t,/^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/,[1],1)||replRx(t,/^(.+?)(s|t)(ion)$/,[1,2],1)||t}
    function s5a(t){var m=meas(t.replace(/e$/,''));if(m>1||(m===1&&!(catChars(t).substr(-4,3)==='CVC'&&t.match(/[^wxy].$/))))t=t.replace(/e$/,'');return t}
    function s5b(t){if(meas(t)>1)return t.replace(/ll$/,'l');return t}
    function stem(w){if(w.length<3)return w;return s5b(s5a(s4(s3(s2(s1c(s1b(s1a(w.toLowerCase()))))))));}

    var text = ((value.title || '') + ' ' + (value.description || '') + ' ' + (value.code || '')).toLowerCase();
    var words = text.split(/[^a-z]+/).filter(function(w) { return w; });
    var stemmed = words.map(stem);
    var totalTerms = stemmed.length;
    if (totalTerms === 0) return [];

    var tfCounts = {};
    for (var i = 0; i < queryStems.length; i++) tfCounts[queryStems[i]] = 0;
    for (var j = 0; j < stemmed.length; j++) {
      if (tfCounts.hasOwnProperty(stemmed[j])) tfCounts[stemmed[j]]++;
    }

    var out = [];
    for (var k = 0; k < queryStems.length; k++) {
      var term = queryStems[k];
      if (tfCounts[term] > 0) {
        var o = {};
        o[term] = {
          key: key,
          code: value.code,
          title: value.title,
          description: value.description,
          instr: value.instr,
          meets: value.meets,
          srcdb: value.srcdb,
          tf: tfCounts[term],
          totalTerms: totalTerms
        };
        out.push(o);
      }
    }
    return out;
  `);

  const reduce = (term, values) => {
    const out = {};
    out[term] = {term, df: values.length, docs: values};
    return out;
  };

  distribution[GID].mr.exec({keys: allKeys, map, reduce}, (err, results) => {
    if (err) return cb(err);

    const docScores = {};
    for (const item of results) {
      for (const term of Object.keys(item)) {
        const data = item[term];
        const idf = Math.log(N / (data.df + 1));
        for (const doc of data.docs) {
          const score = (doc.tf / doc.totalTerms) * idf;
          const dk = doc.key;
          if (!docScores[dk]) {
            docScores[dk] = {
              key: dk,
              code: doc.code,
              title: doc.title,
              description: doc.description,
              instr: doc.instr,
              meets: doc.meets,
              srcdb: doc.srcdb,
              score: 0,
            };
          }
          docScores[dk].score += score;
        }
      }
    }

    const ranked = Object.values(docScores)
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);

    cb(null, {
      results: ranked,
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'tfidf',
    });
  });
}

function searchEmbeddings(queryVec, t0, cb) {
  const queryVecJson = JSON.stringify(queryVec);

  const map = new Function('key', 'value', `
    if (!value.embedding) return [];
    var q = ${queryVecJson};
    var d = value.embedding;
    if (!Array.isArray(d) || d.length !== q.length) return [];
    var dot = 0, normQ = 0, normD = 0;
    for (var i = 0; i < q.length; i++) {
      dot += q[i] * d[i];
      normQ += q[i] * q[i];
      normD += d[i] * d[i];
    }
    var denom = Math.sqrt(normQ) * Math.sqrt(normD);
    if (!denom) return [];
    var sim = dot / denom;
    if (sim < 0.3) return [];
    var o = {};
    o['results'] = {
      key: key,
      code: value.code,
      title: value.title,
      description: value.description,
      instr: value.instr,
      meets: value.meets,
      srcdb: value.srcdb,
      score: sim
    };
    return [o];
  `);

  const reduce = (_, values) => {
    const out = {};
    out.results = values;
    return out;
  };

  distribution[GID].mr.exec({keys: allKeys, map, reduce}, (err, results) => {
    if (err) return cb(err);

    const docs = [];
    for (const item of results) {
      if (item.results) {
        const v = item.results;
        if (Array.isArray(v)) docs.push(...v);
        else docs.push(v);
      }
    }

    const ranked = docs.sort((a, b) => b.score - a.score).slice(0, 50);
    cb(null, {
      results: ranked,
      time_ms: Date.now() - t0,
      total_docs: totalDocs,
      mode: 'embedding',
    });
  });
}

function search(queryStr, semester, cb) {
  const t0 = Date.now();
  const useEmbeddings = !!process.env.OPENAI_API_KEY;

  const wrapFilter = (result) => {
    if (!semester) return result;
    return {
      ...result,
      results: result.results.filter((r) => String(r.srcdb || '').startsWith(String(semester))),
    };
  };

  if (!useEmbeddings) {
    return searchTFIDF(queryStr, t0, (err, result) => {
      if (err) return cb(err);
      cb(null, wrapFilter(result));
    });
  }

  embedQuery(queryStr)
      .then((queryVec) => {
        searchEmbeddings(queryVec, t0, (err, result) => {
          if (err) return cb(err);
          cb(null, wrapFilter(result));
        });
      })
      .catch((err) => {
        console.warn('Embedding query failed, falling back to TF-IDF:', err.message);
        searchTFIDF(queryStr, t0, (tfErr, result) => {
          if (tfErr) return cb(tfErr);
          cb(null, wrapFilter(result));
        });
      });
}

function startHTTPServer() {
  const htmlPath = path.join(__dirname, 'search.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(html);
      return;
    }

    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ok: true, totalDocs, gid: GID}));
      return;
    }

    if (req.method === 'POST' && req.url === '/search') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const {query, semester} = JSON.parse(body);
          if (!query || typeof query !== 'string') {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Missing query string'}));
            return;
          }

          search(query, semester, (err, result) => {
            if (err) {
              console.error('Search error:', err);
              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(JSON.stringify({error: err.message}));
              return;
            }
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify(result));
          });
        } catch (err) {
          res.writeHead(400, {'Content-Type': 'application/json'});
          res.end(JSON.stringify({error: 'Invalid JSON body'}));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(coordinator.httpPort, '0.0.0.0', () => {
    console.log(`Coordinator HTTP server at http://0.0.0.0:${coordinator.httpPort}`);
  });
}

startDistributionNode((err) => {
  if (err) {
    console.error('Failed to start distribution node:', err);
    process.exit(1);
  }

  installGroup((groupErr) => {
    if (groupErr) {
      console.error('Failed to install worker group:', groupErr);
      process.exit(1);
    }

    console.log(`Coordinator installed group '${GID}' with ${cluster.workers.length} workers.`);
    console.log(`Loaded ${totalDocs} keys from all_keys.json.`);
    startHTTPServer();
  });
});