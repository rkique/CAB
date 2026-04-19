const DEPARTMENT_ALIAS_RULES = [
  { program: 'AFRI', aliases: ['Africana Studies'] },
  { program: 'AMST', aliases: ['American Studies'] },
  { program: 'ANTH', aliases: ['Anthropology'] },
  { program: 'APMA', aliases: ['Applied Mathematics'] },
  { program: 'ARCH', aliases: ['Archaeology and Ancient World'] },
  { program: 'BIOL', aliases: ['Biology', 'Biology Undergraduate', 'Biology Graduate'] },
  { program: 'BIOM', aliases: ['Bio-Med', 'Bio Med', 'Biomed'] },
  { program: 'BUSINESS', aliases: ['Business, Entrepreneurship, & Org.', 'Business, Entrepreneurship, Organizations'] },
  { program: 'CHEM', aliases: ['Chemistry'] },
  { program: 'CLAS', aliases: ['Classics'] },
  { program: 'CLPS', aliases: ['Cog, Ling, & Psych Sciences', 'Cognitive and Psychological Sciences'] },
  { program: 'COLT', aliases: ['Comparative Literature'] },
  { program: 'CSCI', aliases: ['Computer Science'] },
  { program: 'DEVL', aliases: ['Development Studies'] },
  { program: 'EAPS', aliases: ['Earth, Environ, & Planet Sciences', 'Earth, Environmental and Planetary Sciences'] },
  { program: 'EAST', aliases: ['East Asian Studies'] },
  { program: 'ECON', aliases: ['Economics'] },
  { program: 'EDUC', aliases: ['Education'] },
  { program: 'EGYT', aliases: ['Egyptology & Assyriology', 'Egyptology and Assyriology'] },
  { program: 'ENGN', aliases: ['Engineering', 'The School of Engineering'] },
  { program: 'ENGL', aliases: ['English'] },
  { program: 'ENVS', aliases: ['Env. & Society', 'Environment and Society', 'Institute at Brown for Environment and Society'] },
  { program: 'FREN', aliases: ['French Studies', 'French and Francophone Studies'] },
  { program: 'GERM', aliases: ['German Studies'] },
  { program: 'HISPANIC', aliases: ['Hispanic Studies'] },
  { program: 'HIST', aliases: ['History'] },
  { program: 'HIAA', aliases: ['History of Art and Architectur.', 'History of Art and Architecture'] },
  { program: 'INTL', aliases: ['International Relations', 'The School of International and Public Affairs'] },
  { program: 'ITAL', aliases: ['Italian Studies'] },
  { program: 'JUDS', aliases: ['Judaic Studies'] },
  { program: 'LACA', aliases: ['Latin Amer & Caribbean Stdy', 'Latin American and Caribbean Studies'] },
  { program: 'LITR', aliases: ['Literary Arts'] },
  { program: 'MATH', aliases: ['Mathematics'] },
  { program: 'MED', aliases: ['Medical Science'] },
  { program: 'MDVL', aliases: ['Medieval Studies'] },
  { program: 'MEST', aliases: ['Middle East Studies', 'Center for Middle East Studies'] },
  { program: 'MCM', aliases: ['Modern Culture and Media'] },
  { program: 'MUSC', aliases: ['Music'] },
  { program: 'NEUR', aliases: ['Neuroscience'] },
  { program: 'PHIL', aliases: ['Philosophy'] },
  { program: 'PHYS', aliases: ['Physics'] },
  { program: 'POLS', aliases: ['Political Science'] },
  { program: 'POBS', aliases: ['Portuguese & Brazilian Studies', 'Portuguese and Brazilian Studies'] },
  { program: 'PHP', aliases: ['Public Health', 'The School of Public Health'] },
  { program: 'PLCY', aliases: ['Public Policy'] },
  { program: 'RELS', aliases: ['Religious Studies'] },
  { program: 'RENS', aliases: ['Renaissance Studies', 'Center for the Study of the Early Modern World'] },
  { program: 'SLAV', aliases: ['Slavic Studies'] },
  { program: 'SOC', aliases: ['Sociology'] },
  { program: 'TAPS', aliases: ['Theatre Arts & Perf. Studies', 'Theatre Arts and Performance Studies'] },
  { program: 'URBN', aliases: ['Urban Studies'] },
  { program: 'VISA', aliases: ['Visual Art'] },
];

const FILTER_FIELDS = new Set([
  'days', 'season', 'year', 'permreq',
  'cr_avg_hours', 'cr_max_hours', 'cr_course_avg', 'cr_prof_avg', 'cr_class_size',
  'course_rating', 'professor_rating', 'average_hours', 'max_hours',
  'instr', 'programs', 'code_prefix',
]);

const VALID_OPS = new Set(['eq', 'ne', 'lt', 'gt', 'lte', 'gte', 'includes_all', 'includes_any']);

function validateFilters(filters) {
  if (!Array.isArray(filters)) return [];
  return filters.filter((c) =>
    c && FILTER_FIELDS.has(c.field) && VALID_OPS.has(c.op) && c.value !== undefined
  );
}

function matchesCondition(fieldValue, op, value) {
  if (fieldValue === null || fieldValue === undefined) return false;
  switch (op) {
    case 'eq': return fieldValue === value;
    case 'ne': return fieldValue !== value;
    case 'lt': return typeof fieldValue === 'number' && fieldValue < value;
    case 'gt': return typeof fieldValue === 'number' && fieldValue > value;
    case 'lte': return typeof fieldValue === 'number' && fieldValue <= value;
    case 'gte': return typeof fieldValue === 'number' && fieldValue >= value;
    case 'includes_all':
      return Array.isArray(fieldValue) && Array.isArray(value) &&
        value.every((v) => fieldValue.includes(v));
    case 'includes_any':
      return Array.isArray(fieldValue) && Array.isArray(value) &&
        value.some((v) => fieldValue.includes(v));
    default: return false;
  }
}

function getCourseCodePrefix(course) {
  return String(course && course.code ? course.code : '')
    .split(/\s+/)[0]
    .toUpperCase();
}

function matchesCodePrefixFilter(course, op, value) {
  const prefix = getCourseCodePrefix(course);
  if (!prefix) return false;

  if (op === 'eq') return prefix === String(value || '').toUpperCase();
  if (op === 'ne') return prefix !== String(value || '').toUpperCase();

  if ((op === 'includes_any' || op === 'includes_all') && Array.isArray(value)) {
    const normalized = value.map((v) => String(v || '').toUpperCase());
    return normalized.includes(prefix);
  }

  return false;
}

function sectionMatchesAll(section, filters, course) {
  return filters.every((c) => {
    if (c.field === 'code_prefix') {
      return matchesCodePrefixFilter(course, c.op, c.value);
    }
    return matchesCondition(section[c.field], c.op, c.value);
  });
}

function applyFilters(results, filters = []) {
  if (!filters || filters.length === 0) return results;
  return results
    .map((course) => {
      const sections = (course.sections || []).filter((s) => sectionMatchesAll(s, filters, course));
      return { ...course, sections };
    })
    .filter((course) => course.sections.length > 0);
}

function getFirstFilterByField(filters, field) {
  if (!Array.isArray(filters)) return null;
  return filters.find((f) => f && f.field === field) || null;
}

function buildDepartmentPriorityFilterStages(filters) {
  const departmentFilter = getFirstFilterByField(filters, 'code_prefix');
  if (!departmentFilter) return null;

  const daysFilter = getFirstFilterByField(filters, 'days');
  const crAvgHoursFilter = getFirstFilterByField(filters, 'cr_avg_hours');

  const stages = [[departmentFilter]];
  if (daysFilter) stages.push([departmentFilter, daysFilter]);
  if (daysFilter && crAvgHoursFilter) stages.push([departmentFilter, daysFilter, crAvgHoursFilter]);
  return stages;
}

function mergeStageResults(stageResults, topK) {
  const out = [];
  const seen = new Set();

  for (const results of stageResults) {
    for (const r of results || []) {
      if (!r || !r.code || seen.has(r.code)) continue;
      seen.add(r.code);
      out.push(r);
      if (out.length >= topK) return out;
    }
  }

  return out;
}

function getFaissK(topK, filters = []) {
  const multiplier = 3 + filters.length;
  return topK * multiplier;
}

function normalizeAliasText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryContainsAlias(normalizedQuery, alias) {
  const normalizedAlias = normalizeAliasText(alias);
  if (!normalizedAlias) return false;
  return ` ${normalizedQuery} `.includes(` ${normalizedAlias} `);
}

function extractDepartmentPrograms(queryStr) {
  const normalizedQuery = normalizeAliasText(queryStr);
  if (!normalizedQuery) return [];

  const programs = new Set();
  for (const rule of DEPARTMENT_ALIAS_RULES) {
    const aliases = [rule.program, ...(rule.aliases || [])];
    if (aliases.some((alias) => queryContainsAlias(normalizedQuery, alias))) {
      programs.add(rule.program);
    }
  }

  return [...programs];
}

function rewriteDepartmentProgramFilters(filters) {
  if (!Array.isArray(filters)) return [];

  const knownDepartmentCodes = new Set(DEPARTMENT_ALIAS_RULES.map((r) => r.program));
  const rewritten = [];

  for (const f of filters) {
    if (!f || f.field !== 'programs') {
      rewritten.push(f);
      continue;
    }

    const values = Array.isArray(f.value) ? f.value : [f.value];
    const deptCodes = values
      .map((v) => String(v || '').toUpperCase())
      .filter((v) => knownDepartmentCodes.has(v));

    if (deptCodes.length === 0) {
      rewritten.push(f);
      continue;
    }

    rewritten.push({ field: 'code_prefix', op: 'includes_any', value: [...new Set(deptCodes)] });
  }

  return rewritten;
}

function augmentDepartmentFilters(filters, queryStr) {
  if (!Array.isArray(filters)) return [];
  const hasCodePrefixFilter = filters.some((f) => f && f.field === 'code_prefix');
  if (hasCodePrefixFilter) return filters;

  const programs = extractDepartmentPrograms(queryStr);
  if (programs.length === 0) return filters;

  return [
    ...filters,
    { field: 'code_prefix', op: 'includes_any', value: programs },
  ];
}

module.exports = {
  FILTER_FIELDS,
  VALID_OPS,
  validateFilters,
  matchesCondition,
  sectionMatchesAll,
  applyFilters,
  getFirstFilterByField,
  buildDepartmentPriorityFilterStages,
  mergeStageResults,
  getFaissK,
  normalizeAliasText,
  extractDepartmentPrograms,
  rewriteDepartmentProgramFilters,
  augmentDepartmentFilters,
};
