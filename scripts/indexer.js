//indexer

//Reads courses_overview.json + embeddings.jsonl
//Collapses by course code (so that there's only one record per unique course)
//Also uses FAISS indexing for the search query

const { IndexFlatIP } = require('faiss-node');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const util = require('util');
const DATA_DIR = path.join(__dirname, '..', 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses_overview.json');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.jsonl');

function normalize(v) {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return v.map(x => x / norm);
}

function parseDays(meets) {
    if (!meets || meets === 'TBA') return [];
    const days = [];
    if (meets.includes('M')) days.push('M');
    if (meets.match(/Tu/)) days.push('Tu');
    if (meets.includes('W')) days.push('W');
    if (meets.match(/Th/)) days.push('Th');
    if (meets.match(/T(?!h|u)/)) days.push('T');
    if (meets.includes('F')) days.push('F');

    return days;
}

async function buildCourseMap() {
    console.log('-------------- courses_overview.json -----------------');
    const raw = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));

    const courseMap = {};
    let total = 0;

    for (const sem of raw) {
        if (!sem.results) continue;
        const srcdb = sem.srcdb;
        for (const c of sem.results) {
            const key = `${c.crn}:${c.srcdb || srcdb}`;
            courseMap[key] = {...c, srcdb: c.srcdb || srcdb};
            total++;
        }
    }

    console.log(`Able to retrieve ${total} sections`);
    return courseMap;
}

function parseSrcdb(srcdb) {
  const year = srcdb.slice(0, 4);
  const code = srcdb.slice(4);
  const seasons = { '00': 'Summer', '10': 'Fall', '15': 'Winter', '20': 'Spring' };
  const season = seasons[code] || 'Unknown';
  return {
    semester: `${season} ${year}`,
    season,
    year: parseInt(year),
  };
}

async function buildIndex(courseMap) {
    console.log('---------------- building index --------------');

    const index = {};
    let seen = 0;
    let skipped = 0;

    const rl = readline.createInterface({input : fs.createReadStream(EMBEDDINGS_FILE)});

    for await (const line of rl) {
        if (!line.trim()) continue;

        const { k ,v } = JSON.parse(line);
        const course = courseMap[k];

        if (!course) {
            skipped++;
            continue;
        }

        seen++;

        if (!index[course.code]) {
            index[course.code] = {
                code: course.code, 
                title: course.title,
                description: course.description || '', 
                vector: normalize(v),
                sections: [],
            };
        }

        index[course.code].sections.push({
            crn: course.crn,
            srcdb: course.srcdb,
            ...parseSrcdb(course.srcdb),
            instr: course.instr || '',
            meets: course.meets || 'TBA',
            days: parseDays(course.meets),
            meetingTimes: course.meetingTimes || '[]',
            start_date: course.start_date || '',
            end_date: course.end_date || '',
            permreq: course.permreq || 'N',
            schd: course.schd || '',
        });
    }

    console.log(`Processed ${seen} embeddings`);
    console.log(`${Object.keys(index).length} unique courses`);
    console.log(`${skipped} skipped`);

    return index;
}

async function saveIndex(index, outputFile = 'index.json') {
    const outPath = path.join(DATA_DIR, outputFile);
    fs.writeFileSync(outPath, JSON.stringify(index, null, 2));
    console.log(`index saved to ${outPath}`);
}

function buildFaissIndex(index) {
    console.log('------------------- faiss -------------------');

    const records = Object.values(index);
    const dim = records[0].vector.length;

    const faissIndex = new IndexFlatIP(dim);
    const idMap = [];
    const flat = [];
    
    records.forEach((r, i) => {
        flat.push(...r.vector);
        idMap.push(r.code);
    })

    faissIndex.add(flat);
    console.log(`FAISS index built with ${faissIndex.ntotal()} vectors.`);

    return { faissIndex, idMap }
}

async function saveFaissIndex(faissIndex, idMap, index) {
  const idMapPath = path.join(DATA_DIR, 'idmap.json');
  fs.writeFileSync(idMapPath, JSON.stringify(idMap, null, 2));
  console.log(`idMap saved to ${idMapPath}`);

  const records = Object.values(index);
  const readable = records.map(r => ({
    code: r.code,
    title: r.title,
    vector: r.vector,
  }));

  const readablePath = path.join(DATA_DIR, 'faiss_readable.json');
  fs.writeFileSync(readablePath, JSON.stringify(readable, null, 2));
  console.log(`Readable FAISS index saved to ${readablePath}`);
}

function testSearch(faissIndex, idMap, index, topK = 5) {
  console.log('------------------- test search -------------------');

  const records = Object.values(index);

  const testRecord = records[Math.floor(Math.random() * records.length)];
  console.log(`Query course: ${testRecord.code} — ${testRecord.title}`);
  console.log(`Description: ${testRecord.description.slice(0, 100)}...`);

  const { labels, distances } = faissIndex.search(testRecord.vector, topK);

  console.log(labels)
  console.log(`Top ${topK} similar courses:`);
  labels.forEach((idx, i) => {
    const match = index[idMap[idx]];
    console.log(`  ${i + 1}. [${distances[i].toFixed(4)}] ${match.code} — ${match.title}`);
  });
}

// function distribute(index, distribution, groupname) {
//     console.log(`Distributing to group "${groupname}"...`);

//     const entries = Object.entries(index);
//     let done = 0;
//     const errors = [];

//     const BATCH = 50;
//     for (let i = 0; i < entries.length; i += BATCH) {
//         const batch = entries.slice(i, i + BATCH);
//         for (const [code, record] of batch) {
//             distribution[groupname].store.put(record, code, (err) => {
//                 if (err) {
//                     errors++;
//                     console.warn(`Error storing ${code}: ${err}`);
//                 } else {
//                     done++;
//                 }
//             })
//         }
//     }
// }

// function distribute(index, distribution, groupname) {
//   console.log(`Distributing to group "${groupname}"...`);

//   const entries = Object.entries(index);
//   let done = 0;
//   let errors = 0;

//   return new Promise((resolve, reject) => {
//     let pending = entries.length;

//     for (const [code, record] of entries) {
//       distribution[groupname].store.put(record, code, (err) => {
//         if (err) {
//           errors++;
//           console.warn(`  Error storing ${code}: ${err}`);
//         } else {
//           done++;
//         }

//         pending--;
//         if (pending === 0) {
//           console.log(`Done. ${done} courses distributed, ${errors} errors.`);
//           resolve();
//         }
//       });
//     }
//   });
// }

function distribute(index, distribution, groupname) {
  console.log(`Distributing to group "${groupname}"...`);

  const entries = Object.entries(index);
  let done = 0;
  let errors = 0;

  return new Promise((resolve, reject) => {
    const CONCURRENCY = 20;   // max simultaneous puts
    let activeCount = 0;
    let entryIndex = 0;

    function next() {
      // fill up to CONCURRENCY active requests
      while (activeCount < CONCURRENCY && entryIndex < entries.length) {
        const [code, record] = entries[entryIndex++];
        activeCount++;

        distribution[groupname].store.put(record, code, (err) => {
          activeCount--;
          if (err) {
            errors++;
            console.warn(`  Error storing ${code}: ${err.message}`);
          } else {
            done++;
            if (done % 100 === 0) {
              console.log(`  ${done}/${entries.length} courses distributed...`);
            }
          }

          if (entryIndex < entries.length) {
            next();   // kick off next batch
          } else if (activeCount === 0) {
            console.log(`Done. ${done} courses distributed, ${errors} errors.`);
            resolve();
          }
        });
      }
    }

    next();
  });
}

async function runIndexer(distribution, groupname) {
    const courseMap = await buildCourseMap();
    const index = await buildIndex(courseMap);
    // const { faissIndex, idMap } = buildFaissIndex(index);
    await distribute(index, distribution, groupname);

    return { index };
}

if (require.main === module) {
  (async () => {
    const courseMap = await buildCourseMap();
    const index = await buildIndex(courseMap);
    const {faissIndex, idMap } = buildFaissIndex(index);

    console.log(`total vectors: ${faissIndex.ntotal()}`);
    console.log(`dimensions: ${faissIndex.getDimension()}`);
    await saveFaissIndex(faissIndex, idMap, index);
    await saveIndex(index);

    testSearch(faissIndex, idMap, index);
  })().catch(console.error);
}

module.exports = { runIndexer }