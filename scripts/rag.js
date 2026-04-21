/**
 * rag.js
 *
 * RAG response generator. Takes a user query and FAISS-retrieved candidate
 * courses, filters to currently offered semesters, calls an OpenAI chat model
 * to produce a grounded natural-language answer that references specific courses.
 */

const fs = require('fs');
const path = require('path');

const GENERATION_MODEL = 'gpt-5.4-mini';
const MAX_CONTEXT_COURSES = 40;
const MAX_DESC_CHARS = 400;

// Load current course codes
const CURRENT_FILE = path.join(__dirname, '..', 'data', 'current_courses.json');
const currentData = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8'));
const CURRENT_CODES = new Set(currentData.codes);
const CURRENT_SEMESTERS = currentData.semesters.join(' and ');

const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'rag_prompt.txt'), 'utf8').trim();


function formatCourse(c) {
  const sections = c.sections || [];

  const obj = {
    code: c.code,
    title: c.title,
    description: (c.description || '').slice(0, MAX_DESC_CHARS),
    semesters: [...new Set(sections.map((s) => s.semester).filter(Boolean))].slice(0, 5),
    meets: [...new Set(sections.map((s) => s.meets).filter((m) => m && m !== 'TBA'))].slice(0, 3),
    instructors: [...new Set(sections.map((s) => s.instr).filter(Boolean))].slice(0, 3),
  };

  // Aggregate CR / rating fields from the most recent section that has them
  const crFields = [
    'cr_avg_hours', 'cr_max_hours', 'cr_course_avg', 'cr_prof_avg',
    'cr_class_size', 'cr_num_respondents', 'cr_attendance', 'cr_grades',
    'cr_professor', 'cr_edition', 'cr_requirement',
    'course_rating', 'professor_rating', 'average_hours', 'max_hours',
    'programs',
  ];
  // Pick from the most recent section with data
  const sorted = [...sections].sort((a, b) => (b.srcdb || '').localeCompare(a.srcdb || ''));
  for (const field of crFields) {
    for (const s of sorted) {
      if (s[field] != null && s[field] !== '') {
        obj[field] = s[field];
        break;
      }
    }
  }

  // Enrollment breakdown
  const enrollFields = ['cr_frosh', 'cr_soph', 'cr_jun', 'cr_sen', 'cr_grad', 'cr_concs', 'cr_nonconcs'];
  const enrollment = {};
  for (const field of enrollFields) {
    for (const s of sorted) {
      if (s[field] != null && s[field] !== '') {
        enrollment[field.replace('cr_', '')] = s[field];
        break;
      }
    }
  }
  if (Object.keys(enrollment).length > 0) obj.cr_enrollment = enrollment;

  return obj;
}

function formatFilterDescription(f) {
  const val = Array.isArray(f.value) ? f.value.join(', ') : f.value;
  return `${f.field} ${f.op} ${val}`;
}

function buildContext(bestMatches, otherCandidates, partialMatches, unmatchedFilters, note) {
  const context = {};

  if (note) {
    context.query_note = note;
  }

  if (bestMatches.length > 0) {
    context.best_matches = {
      label: 'Courses matching all specified filters',
      courses: bestMatches.map(formatCourse),
    };
  } else {
    context.best_matches = {
      label: 'No courses matched all specified filters',
      courses: [],
    };
  }

  if (partialMatches && partialMatches.length > 0) {
    const unmatchedDesc = unmatchedFilters && unmatchedFilters.length > 0
      ? unmatchedFilters.map(formatFilterDescription).join('; ')
      : 'unknown';
    context.partial_matches = {
      label: `Courses matching department filter but NOT: ${unmatchedDesc}`,
      note: 'These courses match the department/subject but do not satisfy all requested filters. Inform the student which filters could not be satisfied.',
      courses: partialMatches.map(formatCourse),
    };
  }

  if (otherCandidates.length > 0) {
    context.other_relevant = {
      label: 'Other relevant courses (may not match all filters)',
      courses: otherCandidates.slice(0, 10).map(formatCourse),
    };
  }

  return JSON.stringify(context, null, 2);
}

function parseCitedCourses(text) {
  const match = text.match(/CITED_COURSES:\s*(\[.*\])/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (_) {}
  }
  // Fallback: extract **CODE: Title** patterns
  const codes = [];
  const re = /\*\*([A-Z]{2,5}\s+\d{4}[A-Z]?)[\s:]/g;
  let m;
  while ((m = re.exec(text)) !== null) codes.push(m[1]);
  return [...new Set(codes)];
}

function cleanAnswer(text) {
  return text.replace(/\n?CITED_COURSES:\s*\[.*\]/, '').trim();
}

function sanitizeQuery(query) {
  // Strip any CITED_COURSES pattern so a crafted query can't poison the parser
  return query.replace(/CITED_COURSES\s*:\s*\[.*?\]/gi, '').trim();
}


async function generateRAGResponse(client, query, bestMatches, otherCandidates, partialMatches, unmatchedFilters) {
  partialMatches = partialMatches || [];
  unmatchedFilters = unmatchedFilters || [];

  // Auto-generate note when partial matches exist but no full matches
  let note = null;
  if (bestMatches.length === 0 && partialMatches.length > 0 && unmatchedFilters.length > 0) {
    const unmatchedDesc = unmatchedFilters.map(formatFilterDescription).join(', ');
    note = `No courses matched all filters. The following constraints were not satisfied: ${unmatchedDesc}.`;
  }

  console.log(`[rag] ${bestMatches.map((c) => c.code).join(', ') || '(none)'} matched all filters`);
  if (partialMatches.length > 0) {
    console.log(`[rag] ${partialMatches.map((c) => c.code).join(', ')} partial matches (unmet: ${unmatchedFilters.map(formatFilterDescription).join('; ')})`);
  }
  console.log(`[rag] ${otherCandidates.map((c) => c.code).join(', ')} other relevant candidates`);
  if (note) console.log(`[rag] query note: ${note}`);
  const context = buildContext(
    bestMatches.slice(0, MAX_CONTEXT_COURSES),
    otherCandidates.slice(0, MAX_CONTEXT_COURSES),
    partialMatches.slice(0, MAX_CONTEXT_COURSES),
    unmatchedFilters,
    note,
  );

  const response = await client.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: `Student query: "${query}"\n\n${context}`},
    ],
    temperature: 0.3,
    max_completion_tokens: 1024,
  });

  const raw = response.choices[0].message.content;
  const cited = parseCitedCourses(raw);
  const answer = cleanAnswer(raw);

  return {answer, cited_courses: cited};
}

module.exports = {generateRAGResponse};
