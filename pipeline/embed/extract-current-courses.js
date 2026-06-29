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

const DATA_DIR = path.join(__dirname, '..', 'data');
const COURSES_FILE = path.join(DATA_DIR, 'courses_overview.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'current_courses.json');

const TARGET_SRCDBS = {
  '202610': 'Fall 2026',
  '202720': 'Spring 2027',
};

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
