/**
 * rag.js
 *
 * RAG response generator. Takes a user query and FAISS-retrieved candidate
 * courses, filters to currently offered semesters, calls an OpenAI chat model
 * to produce a grounded natural-language answer that references specific courses.
 */

const fs = require('fs');
const path = require('path');

const GENERATION_MODEL = 'gpt-4.1-mini';
const MAX_CONTEXT_COURSES = 40;
const MAX_DESC_CHARS = 400;

// Load current course codes
const CURRENT_FILE = path.join(__dirname, '..', 'data', 'current_courses.json');
const currentData = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8'));
const CURRENT_CODES = new Set(currentData.codes);
const CURRENT_SEMESTERS = currentData.semesters.join(' and ');

const SYSTEM_PROMPT = `You are a knowledgeable Brown University course advisor. A student will ask about courses and you will receive two lists of candidate courses from the catalog:

1. CURRENTLY OFFERED — courses available in ${CURRENT_SEMESTERS}. You should primarily recommend from this list.
2. OTHER RELEVANT — courses that match the query but are NOT currently offered. You may briefly mention these as alternatives the student could look into in future semesters, but clearly note they are not currently offered.

Your job:
- Write a helpful, concise response recommending relevant courses.
- Prioritize currently offered courses. If none of the currently offered courses match the query well, say so honestly and mention relevant alternatives from the other list.
- Reference courses using the exact format: **CODE: Title** (e.g. **CSCI 1380: Distributed Computer Systems**)
- Consider course level (0000-level = intro, 1000+ = advanced), description content, meeting patterns, and any other relevant signals.
- Keep your response to 2-4 short paragraphs. Be direct and informative.
- Do NOT invent courses. Only reference courses from the provided lists.
- After your response, output a JSON block on its own line in this exact format:
CITED_COURSES: ["CODE1", "CODE2", ...]
listing every course code you mentioned.`;

function buildContext(currentCandidates, otherCandidates) {
  function formatCourse(c, i) {
    const desc = (c.description || '').slice(0, MAX_DESC_CHARS);
    const semesters = (c.sections || [])
      .map((s) => s.semester)
      .filter(Boolean);
    const unique = [...new Set(semesters)].slice(0, 5);
    const semStr = unique.length > 0 ? unique.join(', ') : 'N/A';

    const meets = (c.sections || [])
      .map((s) => s.meets)
      .filter((m) => m && m !== 'TBA');
    const meetStr = [...new Set(meets)].slice(0, 3).join(' / ') || 'TBA';

    return `${i + 1}. [${c.code}] ${c.title}\n   Meets: ${meetStr} | Offered: ${semStr}\n   ${desc}`;
  }

  let text = '';

  if (currentCandidates.length > 0) {
    text += `CURRENTLY OFFERED (${CURRENT_SEMESTERS}):\n`;
    text += currentCandidates.map(formatCourse).join('\n\n');
  } else {
    text += `CURRENTLY OFFERED: None of the retrieved courses are offered in ${CURRENT_SEMESTERS}.\n`;
  }

  if (otherCandidates.length > 0) {
    text += `\n\nOTHER RELEVANT (not currently offered):\n`;
    text += otherCandidates.slice(0, 10).map(formatCourse).join('\n\n');
  }

  return text;
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

async function generateRAGResponse(client, query, candidates) {
  const current = [];
  const other = [];

  for (const c of candidates.slice(0, MAX_CONTEXT_COURSES)) {
    if (CURRENT_CODES.has(c.code)) {
      current.push(c);
    } else {
      other.push(c);
    }
  }

  const context = buildContext(current, other);

  const response = await client.chat.completions.create({
    model: GENERATION_MODEL,
    messages: [
      {role: 'system', content: SYSTEM_PROMPT},
      {role: 'user', content: `Student query: "${query}"\n\n${context}`},
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const raw = response.choices[0].message.content;
  const cited = parseCitedCourses(raw);
  const answer = cleanAnswer(raw);

  return {answer, cited_courses: cited};
}

module.exports = {generateRAGResponse};
