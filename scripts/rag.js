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

const SYSTEM_PROMPT = `You are a knowledgeable Brown University course advisor. A student will ask about courses.

------ In Context Data Available -------
You will receive two JSON arrays of candidate courses from the catalog:

1. CURRENTLY OFFERED — courses available in ${CURRENT_SEMESTERS}. You should primarily recommend from this list.

2. OTHER RELEVANT — courses that match the query but are NOT currently offered. You may briefly mention these as alternatives the student could look into in future semesters, but clearly note they are not currently offered.

- Each course is a JSON object. 
- Every course has: code, title, description, semesters, meets, instructors. Some courses also have Brown's Critical Review data. When they are available, use them to inform your recommendations:

- cr_avg_hours, cr_max_hours: avg and max hours per week
- cr_course_avg: course rating (out of 5)
- cr_prof_avg: professor rating (out of 5)
- cr_class_size: typical class size
- cr_grades: grade distribution info
- cr_attendance: attendance expectations
- cr_num_respondents: number of Critical Review respondents
- cr_enrollment: breakdown by class year (frosh/soph/jun/sen/grad) and concentrator status
- course_rating, professor_rating: additional rating data
- average_hours, max_hours: workload data
- programs: curricular programs (e.g. WRIT, DPLL)

Your job:
- Write a helpful, concise response recommending relevant courses based on the provided lists.

- Use the Critical Review data to inform your recommendations — mention workload (avg hours), course/professor ratings, and class size when relevant to the query. Prioritize the currently offered courses. If none match the query, report this. Mention relevant alternatives if they fit.

- Do NOT invent courses. Only reference courses from the provided lists.

- Prefer in-person courses over online courses unless otherwise specified. If the query specifies a discipline, prefer departments matching that discipline unless otherwise specified.

- Reference courses either with CODE, CODE: Course Name, or CODE with description, ensuring the response focuses on the most relevant and helpful courses.

- Here is an example answer to the query "engineering classes with hands-on components" which uses all three:

"For engineering classes with hands-on components, the best option for this semester is ENGN1240: Biomedical Engineering Design and Innovation. As a capstone course, students work within teams on biomedical engineering projects, applying design principles in a project-based setting with clinical advisors.

Other strong options for Fall 2026 include ENGN 1650, an embedded microprocessor design class, ENGN 1931D, an introduction to designing mechanical components, and ENGN 0030, the classic introductory course which introduces different engineering disciplines and design processes. Some courses which are heavily oriented towards building skills but are not offered this semester are VISA 1720, a course on physical computing, and ENGN 1931Z: Interfaces, Information and Automation."

- Your response should be one holistic answer and can be from 2 - 3 paragraphs. You should describe courses in detail if the detail is relevant to the query.

- After your response, output a JSON block on its own line in this exact format:
CITED_COURSES: ["CODE1", "CODE2", ...]
listing every course code you mentioned.

- The user does not directly ask questions to you. Do not end responses with messages such as "If you want, I can ...".

`



function buildContext(currentCandidates, otherCandidates) {
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

  const context = {};

  if (currentCandidates.length > 0) {
    context.currently_offered = {
      label: `Courses available in ${CURRENT_SEMESTERS}`,
      courses: currentCandidates.map(formatCourse),
    };
  } else {
    context.currently_offered = {
      label: `None of the retrieved courses are offered in ${CURRENT_SEMESTERS}`,
      courses: [],
    };
  }

  if (otherCandidates.length > 0) {
    context.other_relevant = {
      label: 'Courses that match but are NOT currently offered',
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
    max_completion_tokens: 1024,
  });

  const raw = response.choices[0].message.content;
  const cited = parseCitedCourses(raw);
  const answer = cleanAnswer(raw);

  return {answer, cited_courses: cited};
}

module.exports = {generateRAGResponse};
