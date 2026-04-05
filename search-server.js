#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const natural = require('natural/lib/natural/stemmers/porter_stemmer');

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
const distribution = require('./distribution.js')({ip: '127.0.0.1', port: DIST_PORT});

let allKeys = [];
let totalDocs = 0;

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

//load courses across nodes via. distribution.group.put
function loadCourses(cb) {
  console.log('Loading courses...');
  const raw = fs.readFileSync(path.join(__dirname, 'courses_overview.json'), 'utf8');
  const semesters = JSON.parse(raw);

  const courses = [];
  for (const sem of semesters) {
    if (!sem.results) continue;
    for (const c of sem.results) {
      courses.push({
        code: c.code || '',
        title: c.title || '',
        description: c.description || '',
        crn: c.crn || '',
        srcdb: c.srcdb || sem.srcdb || '',
        instr: c.instr || '',
        meets: c.meets || '',
      });
    }
  }

  totalDocs = courses.length;
  console.log(`Parsed ${totalDocs} courses, storing...`);

  let i = 0;
  const BATCH = 50;

  function next() {
    if (i >= courses.length) {
      console.log(`All ${totalDocs} courses stored.`);
      return cb();
    }

    let pending = 0;
    let errored = false;
    const end = Math.min(i + BATCH, courses.length);

    for (; i < end; i++) {
      const c = courses[i];
      const key = `${c.crn}:${c.srcdb}`;
      allKeys.push(key);
      pending++;

      distribution[GID].store.put(c, key, (e) => {
        if (errored) return;
        if (e) {
          errored = true;
          return cb(e);
        }
        pending--;
        if (pending === 0) next();
      });
    }
  }

  next();
}

function search(queryStr, cb) {
  const t0 = Date.now();
  const tokens = tokenize(queryStr);
  const queryStems = [...new Set(stemTokens(tokens))];

  if (queryStems.length === 0) {
    return cb(null, {results: [], time_ms: Date.now() - t0, total_docs: totalDocs});
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

  //Aggregate documents for a single term.
  const reduce = (term, values) => {
    const out = {};
    out[term] = {term: term, df: values.length, docs: values};
    return out;
  };

  distribution[GID].mr.exec({keys: allKeys, map, reduce}, (err, results) => {
    if (err) return cb(err);

    // Post-MR scoring: compute TF-IDF per document
    const docScores = {};

    for (const item of results) {
      for (const term of Object.keys(item)) {
        const data = item[term];
        const df = data.df;
        const idf = Math.log(N / (df + 1));

        for (const doc of data.docs) {
          const tfNorm = doc.tf / doc.totalTerms;
          const score = tfNorm * idf;
          const dk = doc.key;

          if (!docScores[dk]) {
            docScores[dk] = {
              code: doc.code,
              title: doc.title,
              description: doc.description,
              instr: doc.instr,
              meets: doc.meets,
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

    cb(null, {results: ranked, time_ms: Date.now() - t0, total_docs: totalDocs});
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
    loadCourses((e) => {
      if (e) {
        console.error('Course loading failed:', e);
        process.exit(1);
      }
      startHTTPServer();
    });
  });
});
