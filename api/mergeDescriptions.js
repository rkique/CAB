#!/usr/bin/env node

/**
 * Merge course descriptions into courses_overview.json.
 *
 * Input:
 *   - courses_overview.json  (array of {srcdb, results[]})
 *   - course_descriptions.json (array of {code, title, crn, srcdb, description})
 *
 * Output:
 *   - courses_overview.json is rewritten in-place with a `description` field
 *     added to every course section that has a matching description.
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const overviewPath = path.join(dataDir, 'courses_overview.json');
const descriptionsPath = path.join(dataDir, 'course_descriptions.json');

console.log('Loading course_descriptions.json...');
const descriptions = JSON.parse(fs.readFileSync(descriptionsPath, 'utf-8'));

// Build lookup: "crn:srcdb" -> description
const descMap = new Map();
for (const d of descriptions) {
  if (d.description) {
    descMap.set(`${d.crn}:${d.srcdb}`, d.description);
  }
}
console.log(`Built description map: ${descMap.size} entries with descriptions`);

console.log('Loading courses_overview.json...');
const overview = JSON.parse(fs.readFileSync(overviewPath, 'utf-8'));

let matched = 0;
let unmatched = 0;
let totalSections = 0;

for (const semester of overview) {
  for (const course of semester.results) {
    totalSections++;
    const key = `${course.crn}:${course.srcdb}`;
    const desc = descMap.get(key);
    if (desc) {
      course.description = desc;
      matched++;
    } else {
      unmatched++;
    }
  }
}

console.log(`Total sections: ${totalSections}`);
console.log(`Matched with descriptions: ${matched}`);
console.log(`No description found: ${unmatched}`);

console.log('Writing merged courses_overview.json...');
fs.writeFileSync(overviewPath, JSON.stringify(overview, null, 4));
console.log('Done.');
