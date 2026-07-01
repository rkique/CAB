#!/usr/bin/env node
/**
 * extract-current-courses.js
 *
 * Extracts course codes offered in the current/upcoming semesters
 * (Fall 2026, Spring 2027) and writes them to data/current_courses.json.
 *
 * Output format:
 * {
 *   "semesters": ["Fall 2026", "Spring 2027"],
 *   "srcdbs": ["202610", "202720"],
 *   "codes": ["CSCI 1380", "PHIL 0010", ...]
 * }
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses_overview.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'current_courses.json');

const MANIFEST_FILE = path.join(DATA_DIR, 'manifest.json');
const SEASON_MAP = {'00': 'Summer', '10': 'Fall', '15': 'Winter', '20': 'Spring'};

function parseSrcdb(srcdb) {
  const year = srcdb.slice(0, 4);
  const code = srcdb.slice(4);
  return `${SEASON_MAP[code] || 'Unknown'} ${year}`;
}

function deriveCurrentTerms(srcdbs) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const ay = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  let current, next;
  if (month >= 8) {
    current = `${ay}10`;
    next = `${ay + 1}20`;
  } else if (month >= 5) {
    current = `${ay + 1}00`;
    next = `${ay + 1}10`;
  } else {
    current = `${ay}20`;
    next = `${ay + 1}00`;
  }

  const valid = new Set(srcdbs);
  return [current, next].filter((s) => valid.has(s));
}

function getTargetSrcdbs() {
  // Try manifest first
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      const mf = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
      const allSrcdbs = Object.keys(mf.cab?.srcdbs || {});
      if (allSrcdbs.length > 0) {
        const terms = deriveCurrentTerms(allSrcdbs);
        if (terms.length > 0) {
          const out = {};
          for (const s of terms) out[s] = parseSrcdb(s);
          return out;
        }
      }
    } catch (_) { /* fall through */ }
  }

  // Fallback: use the two highest srcdbs from courses_overview.json
  const data = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));
  const allSrcdbs = data.map((s) => s.srcdb).filter(Boolean).sort();
  const top = allSrcdbs.slice(-2);
  const out = {};
  for (const s of top) out[s] = parseSrcdb(s);
  return out;
}

const TARGET_SRCDBS = getTargetSrcdbs();

const raw = JSON.parse(fs.readFileSync(COURSES_FILE, 'utf8'));

const codes = new Set();
const foundSemesters = [];
const foundSrcdbs = [];

for (const sem of raw) {
  if (!TARGET_SRCDBS[sem.srcdb]) continue;
  if (!sem.results || sem.results.length === 0) continue;

  foundSemesters.push(TARGET_SRCDBS[sem.srcdb]);
  foundSrcdbs.push(sem.srcdb);

  for (const c of sem.results) {
    if (c.code) codes.add(c.code);
  }
}

const sorted = [...codes].sort();

const output = {
  semesters: foundSemesters,
  srcdbs: foundSrcdbs,
  codes: sorted,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
console.log(`Found ${foundSemesters.length} semester(s): ${foundSemesters.join(', ') || 'none'}`);
console.log(`${sorted.length} unique course codes written to ${OUTPUT_FILE}`);
