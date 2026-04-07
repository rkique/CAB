//indexer

//Reads courses_overview.json + embeddings.jsonl
//Collapses by course code (so that there's only one record per unique course)

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COURSES_FILE = path.join(__dirname, 'courses_overview.json');
const EMBEDDINGS_FILE = path.join(__dirname, 'embeddings.jsonl');

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
                vector: v,
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
    const outPath = path.join(__dirname, outputFile);
    fs.writeFileSync(outPath, JSON.stringify(index, null, 2));
    console.log(`index saved to ${outPath}`);
}

// async function main() {
//     const courseMap = await buildCourseMap();
//     const index = await buildIndex(courseMap);

// }


if (require.main === module) {
  (async () => {
    const courseMap = await buildCourseMap();
    const index    = await buildIndex(courseMap);
    await saveIndex(index);
  })().catch(console.error);
}