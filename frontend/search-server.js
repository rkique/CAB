#!/usr/bin/env node

const { runIndexer } = require('../scripts/indexer.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const natural = require('natural/lib/natural/stemmers/porter_stemmer');

// load localIndex at module level — require works here
const { buildLocalFaiss, localSearch } = require('../scripts/localIndex.js');
globalThis.__buildLocalFaiss = buildLocalFaiss;
globalThis.__localFaissSearch = localSearch;

const DIST_PORT = 3001;
const HTTP_PORT = 3000;
const GID = 'courses';

// Common English stopwords
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

// --- Bootstrap distribution framework ---
const {OpenAI} = require('openai');

// Load API key from openai.key file
const keyPath = path.join(__dirname, '..', 'data', 'openai.key');
const OPENAI_API_KEY = fs.readFileSync(keyPath, 'utf8').trim();

const distribution = require('../distribution.js')({ip: '127.0.0.1', port: DIST_PORT});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 256;

let allKeys = [];
let totalDocs = 0;
let embeddings = {};   // key -> float[], loaded from embeddings.json if present
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
      if (filters.season) {
        sections = sections.filter((s) => s.season === filters.season);
      }
      if (filters.year) {
        sections = sections.filter((s) => s.year === filters.year);
      }
      if (filters.semester) {
        sections = sections.filter((s) => s.semester === filters.semester);
      }
      if (filters.noPermReq) {
        sections = sections.filter((s) => s.permreq === 'N');
      }

      return { ...course, sections };
    })
    .filter((course) => course.sections.length > 0);
}

function deduplicateResults(results) {
  const byTitle = {};

  for (const course of results) {
    // strip cross-listing suffixes like "(ENGL 1711L)"
    const normalizedTitle = course.title.replace(/\s*\(.*?\)\s*$/, '').trim();

    if (!byTitle[normalizedTitle]) {
      byTitle[normalizedTitle] = {
        ...course,
        crossListings: [course.code],
      };
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
  const lower = queryStr.toLowerCase();

  // days
  const days = [];
  if (lower.match(/\bmon(day)?\b|\bmwf\b|\bmw\b/)) days.push('M');
  if (lower.match(/\btue(sday)?\b|\btu\b|\btuth\b|\btuth\b/)) days.push('Tu');
  if (lower.match(/\bwed(nesday)?\b|\bmwf\b|\bmw\b/)) days.push('W');
  if (lower.match(/\bthu(rsday)?\b|\bth\b|\btuth\b/)) days.push('Th');
  if (lower.match(/\bfri(day)?\b|\bmwf\b/)) days.push('F');
  if (days.length > 0) filters.days = [...new Set(days)];

  // season
  if (lower.includes('fall')) filters.season = 'Fall';
  else if (lower.includes('spring')) filters.season = 'Spring';
  else if (lower.includes('summer')) filters.season = 'Summer';
  else if (lower.includes('winter')) filters.season = 'Winter';

  // year e.g. "2026"
  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) filters.year = parseInt(yearMatch[1]);

  // no permission required
  if (lower.match(/\bno perm|\bno permission|\bopen enroll/)) {
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

//load courses across nodes
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
    }
  }

  distribution[GID].routes.put(faissService, 'faiss', (err, val) => {
    console.log('routes.put callback fired, err:', err, 'val:', val);
    if (err && Object.values(err).length > 0) return cb(err);
    console.log('routes.put result:', err, val);

    console.log('sending buildFaiss to all nodes...');
    // pass allKeys when calling buildFaiss
    distribution[GID].comm.send([GID, allKeys], { service: 'faiss', method: 'buildFaiss' }, (err, results) => {
      if (err && Object.values(err).some(Boolean)) return cb(err);
      console.log('All nodes built local FAISS:', results);
      cb();
    });
  })
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({apiKey: OPENAI_API_KEY});
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
  return res.data[0].embedding; // float[]
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
  return raw.map((x) => x / norm);   // ← normalize
}

function searchTFIDF(queryStr, t0, cb) {
  const tokens = tokenize(queryStr);
  const queryStems = [...new Set(stemTokens(tokens))];

  if (queryStems.length === 0) {
    return cb(null, {results: [], time_ms: Date.now() - t0, total_docs: totalDocs, mode: 'tfidf'});
  }

  const querySet = JSON.stringify(queryStems);
  const N = totalDocs;

  const map = new Function('key', 'value', `
    var queryStems = ${querySet};

    // Inline Porter stemmer (from natural, no require needed)
    function catGroups(t){return t.replace(/[^aeiouy]+y/g,'CV').replace(/[aeiou]+/g,'V').replace(/[^V]+/g,'C')}
    function catChars(t){return t.replace(/[^aeiouy]y/g,'CV').replace(/[aeiou]/g,'V').replace(/[^V]/g,'C')}
    function meas(t){if(!t)return -1;return catGroups(t).replace(/^C/,'').replace(/V$/,'').length/2}
    function endsDbl(t){return t.match(/([^aeiou])\\1$/)}
    function attRepl(t,p,r,cb){var res=null;if(typeof p==='string'&&t.substr(0-p.length)===p)res=t.replace(new RegExp(p+'$'),r);else if(p instanceof RegExp&&t.match(p))res=t.replace(p,r);if(res&&cb)return cb(res);return res}
    function attReplPats(t,reps,mt){var r=t;for(var i=0;i<reps.length;i++){if(mt==null||meas(attRepl(t,reps[i][0],reps[i][1]))>mt){r=attRepl(r,reps[i][0],reps[i][2])||r}}return r}
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
    for (var i = 0; i < stemmed.length; i++) {
      if (tfCounts.hasOwnProperty(stemmed[i])) tfCounts[stemmed[i]]++;
    }

    var out = [];
    for (var i = 0; i < queryStems.length; i++) {
      var t = queryStems[i];
      if (tfCounts[t] > 0) {
        var o = {};
        o[t] = {key: key, code: value.code, title: value.title, description: value.description, instr: value.instr, meets: value.meets, tf: tfCounts[t], totalTerms: totalTerms};
        out.push(o);
      }
    }
    return out;
  `);

  const reduce = (term, values) => {
    const out = {};
    out[term] = {term: term, df: values.length, docs: values};
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
            docScores[dk] = {code: doc.code, title: doc.title, description: doc.description, instr: doc.instr, meets: doc.meets, score: 0};
          }
          docScores[dk].score += score;
        }
      }
    }

    const ranked = Object.values(docScores).sort((a, b) => b.score - a.score).slice(0, 50);
    cb(null, {results: ranked, time_ms: Date.now() - t0, total_docs: totalDocs, mode: 'tfidf'});
  });
}

function searchEmbeddings(queryVec, t0, cb) {
  const queryVecJson = JSON.stringify(queryVec);

  const map = new Function('key', 'value', `
    if (!value.embedding) return [];
    var q = ${queryVecJson};
    var d = value.embedding;
    var dot = 0, normQ = 0, normD = 0;
    for (var i = 0; i < q.length; i++) {
      dot += q[i] * d[i];
      normQ += q[i] * q[i];
      normD += d[i] * d[i];
    }
    var sim = dot / (Math.sqrt(normQ) * Math.sqrt(normD));
    if (sim < 0.3) return [];
    var o = {};
    o['results'] = {key: key, code: value.code, title: value.title, description: value.description, instr: value.instr, meets: value.meets, score: sim};
    return [o];
  `);

  const reduce = (_, values) => {
    const out = {};
    out['results'] = values;
    return out;
  };

  distribution[GID].mr.exec({keys: allKeys, map, reduce}, (err, results) => {
    if (err) return cb(err);

    const docs = [];
    for (const item of results) {
      if (item['results']) {
        const v = item['results'];
        if (Array.isArray(v)) docs.push(...v);
        else docs.push(v);
      }
    }

    const ranked = docs.sort((a, b) => b.score - a.score).slice(0, 50);
    cb(null, {results: ranked, time_ms: Date.now() - t0, total_docs: totalDocs, mode: 'embedding'});
  });
}

function searchFaiss(queryVec, queryStr, t0, cb) {
  const topK = 20;

  const filters = parseQueryFilters(queryStr);
  const faissK = getFaissK(topK, filters);
  const queryVecJson = JSON.stringify(queryVec);

  const searchId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const map = new Function('key', 'value', `
    var sid = '__faiss_${searchId}';
    if (globalThis[sid]) return [];
    globalThis[sid] = true;

    if (typeof globalThis.__localFaissSearch !== 'function') {
      throw new Error('__localFaissSearch not ready — buildFaiss may not have run');
    }

    var queryVector = ${queryVecJson};
    var results = globalThis.__localFaissSearch(queryVector, ${faissK});

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

  distribution[GID].mr.exec({ keys : allKeys, map, reduce}, (err, results) => {
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

          const ranked = deduped
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);

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
  // const useEmbeddings = Object.keys(embeddings).length > 0;

  // // if (!useEmbeddings) {
  // //   return searchTFIDF(queryStr, t0, cb);
  // // }

  embedQueryFaiss(queryStr).then((queryVec) => {
    searchFaiss(queryVec, queryStr, t0, cb);
  }).catch((err) => {
    console.warn('Embedding failed, falling back to TF-IDF', err.message || err);
    searchTFIDF(queryStr, t0, cb);
  });
}

// --- HTTP server ---
function startHTTPServer() {
  const htmlPath = path.join(__dirname, 'search.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(html);
      return;
    }

    if (req.method === 'POST' && req.url === '/search') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const {query} = JSON.parse(body);
          if (!query || typeof query !== 'string') {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: 'Missing query string'}));
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

// --- Startup sequence ---
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
