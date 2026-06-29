const fs = require('fs');
const path = require('path');

const CONC_DIR = path.join(__dirname, '..', 'data', 'definitions', 'concentrations');

const ALIASES = {
  'cs': 'comp', 'computer science': 'comp',
  'math': 'math', 'mathematics': 'math',
  'applied math': 'apma', 'apma': 'apma',
  'physics': 'phys', 'phys': 'phys',
  'chemistry': 'chem', 'chem': 'chem',
  'biology': 'biol', 'bio': 'biol',
  'neuroscience': 'neur', 'neuro': 'neur',
  'cognitive science': 'cogs', 'cogsci': 'cogs',
  'cognitive neuroscience': 'cogn',
  'economics': 'econ', 'econ': 'econ',
  'english': 'engl',
  'history': 'hist',
  'philosophy': 'phil', 'phil': 'phil',
  'physics and philosophy': 'phph',
  'psychology': 'psyc', 'psych': 'psyc',
  'sociology': 'soc',
  'linguistics': 'ling', 'ling': 'ling',
  'statistics': 'stat', 'stats': 'stat',
  'public health': 'pubh',
  'political science': 'pols', 'polisci': 'pols', 'poli sci': 'pols',
  'computer engineering': 'coeg',
  'electrical engineering': 'eleg', 'ee': 'eleg',
  'mechanical engineering': 'mceg', 'me': 'mceg',
  'chemical engineering': 'cheg',
  'biomedical engineering': 'enbi', 'bme': 'enbi',
  'engineering': 'engn',
  'environmental science': 'envs', 'envs': 'envs',
  'biochemistry': 'bchm',
  'anthropology': 'anth',
  'astronomy': 'astr', 'astro': 'astr',
  'architecture': 'arct',
  'music': 'musc',
  'art history': 'hiaa',
  'theater': 'taps', 'theatre': 'taps',
  'urban studies': 'urbn',
  'education': 'educ',
  'religious studies': 'rels',
  'east asian studies': 'east',
  'middle east studies': 'mide',
  'africana studies': 'afri',
  'gender studies': 'gnss',
  'latin american': 'lacs',
  'comparative literature': 'colt',
  'literary arts': 'lita',
  'visual art': 'visa',
  'design engineering': 'dese',
  'international affairs': 'iapa', 'iapa': 'iapa',
  'cs-econ': 'csec', 'computer science economics': 'csec',
  'math-cs': 'macs', 'math-econ': 'mtec',
  'earth science': 'eps', 'geology': 'eps',
  'biophysics': 'biop',
  'computational biology': 'csbi',
  'computational neuroscience': 'cneu',
  'science technology society': 'sts', 'sts': 'sts',
  'slavic': 'slav',
  'french': 'ffs',
  'german': 'gmst',
  'italian': 'ital',
  'portuguese': 'pobr',
  'hispanic': 'hslc',
  'classics': 'clas',
  'health and human biology': 'hhbi', 'hhbi': 'hhbi',
  'behavioral decision sciences': 'bds',
  'contemplative studies': 'ctmp',
  'modern culture': 'mcmd',
  'social analysis': 'sar',
};

const slugToName = {};
const keywordIndex = {};

function loadIndex() {
  for (const track of ['general', 'ab', 'scb', 'professional']) {
    const dir = path.join(CONC_DIR, track);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.txt')) continue;
      const slug = file.replace('.txt', '');
      if (slugToName[slug]) continue;
      const firstLine = fs.readFileSync(path.join(dir, file), 'utf8').split('\n')[0];
      const name = firstLine.replace('CONCENTRATION: ', '').trim();
      slugToName[slug] = name;
      keywordIndex[slug] = slug;
      keywordIndex[name.toLowerCase()] = slug;
      for (const word of name.toLowerCase().split(/[\s,&/-]+/)) {
        if (word.length >= 4 && !keywordIndex[word]) keywordIndex[word] = slug;
      }
    }
  }
  for (const [kw, slug] of Object.entries(ALIASES)) keywordIndex[kw] = slug;
}

loadIndex();

// ---------------------------------------------------------------------------
// Text parser — converts a track's .txt content into structured JSON
// ---------------------------------------------------------------------------

const COURSE_RE = /^\s+(?:or\s+)?([A-Z]{2,6}\s+\d{3,4}[A-Z]?)\s*\|\s*(.+?)\s*(?:\|\s*\d*\s*)?$/;
const JOINT_COURSE_RE = /^\s+(?:or\s+)?([A-Z]{2,6}\s+\d{3,4}[A-Z]?)\s*&\s*([A-Z]{2,6}\s+\d{3,4}[A-Z]?)\s*\|\s*(.+?)\s*(?:\|\s*\d*\s*)?$/;
const SEPARATOR_RE = /^[-=]{4,}\s*$/;
const TABLE_ROW_RE = /^\s{2,}.+\|/; // indented line with a pipe — table row

function parseTrackContent(text) {
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;
  let pendingHeading = null;
  let totalCredits = null;

  // Skip header (CONCENTRATION/TRACK/URL/=== lines)
  let start = 0;
  while (start < lines.length && (lines[start].startsWith('CONCENTRATION:') || lines[start].startsWith('TRACK:') || lines[start].startsWith('URL:') || SEPARATOR_RE.test(lines[start].trim()) || lines[start].trim() === '')) start++;

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Section separator pair: --- heading ---
    if (SEPARATOR_RE.test(trimmed)) {
      // Peek at surrounding lines for heading
      const prev = (lines[i - 1] || '').trim();
      const next = (lines[i + 1] || '').trim();
      if (prev && !SEPARATOR_RE.test(prev) && !prev.startsWith('CONCENTRATION') && !prev.startsWith('TRACK') && !prev.startsWith('URL')) {
        pendingHeading = prev;
      } else if (next && !SEPARATOR_RE.test(next)) {
        pendingHeading = next;
        i++; // consume heading line
        i++; // consume closing separator
      }
      if (pendingHeading) {
        currentSection = { heading: pendingHeading, items: [] };
        sections.push(currentSection);
        pendingHeading = null;
      }
      continue;
    }

    if (!trimmed) continue;

    // Ensure we have a section
    if (!currentSection) {
      currentSection = { heading: null, items: [] };
      sections.push(currentSection);
    }

    // Joint course: CODE & CODE | Title
    const jointMatch = JOINT_COURSE_RE.exec(raw);
    if (jointMatch) {
      const isOr = raw.trimStart().startsWith('or ');
      currentSection.items.push({
        type: 'course',
        code: jointMatch[1],
        code2: jointMatch[2],
        title: jointMatch[3],
        isOr,
      });
      continue;
    }

    // Single course: CODE | Title
    const courseMatch = COURSE_RE.exec(raw);
    if (courseMatch) {
      const isOr = raw.trimStart().startsWith('or ');
      currentSection.items.push({ type: 'course', code: courseMatch[1], title: courseMatch[2], isOr });
      continue;
    }

    // Table row (label/grouping): indented line with pipe
    if (TABLE_ROW_RE.test(raw)) {
      const parts = raw.split('|');
      const label = parts[0].trim();
      const count = parts[1] ? parts[1].trim() : '';

      if (label.toLowerCase().startsWith('total credits')) {
        totalCredits = parseInt(count) || null;
        continue;
      }
      // Group label — skip pure noise like "AND", "or", blank series labels
      if (label && label !== 'AND' && label.length > 1) {
        currentSection.items.push({ type: 'label', text: label, count: count || null });
      }
      continue;
    }

    // Non-table text — skip verbose prose (honorus, general info, URLs etc.)
    // Only keep short instructional lines that look like requirements
    if (trimmed.length < 200 && !trimmed.startsWith('http') && !trimmed.startsWith('•')) {
      currentSection.items.push({ type: 'note', text: trimmed });
    }
  }

  // Remove sections that only have notes (prose-only sections like Honors prose)
  const filtered = sections.filter(s =>
    s.items.some(item => item.type === 'course' || item.type === 'label')
  );

  return { sections: filtered, totalCredits };
}

function getConcentrationData(slug) {
  const TRACK_LABELS = { ab: 'A.B.', scb: 'Sc.B.', professional: 'Professional', general: 'General' };
  const result = { slug, name: slugToName[slug] || slug, url: null, tracks: {} };

  for (const track of ['ab', 'scb', 'professional', 'general']) {
    const p = path.join(CONC_DIR, track, `${slug}.txt`);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');

    // Extract URL from header
    if (!result.url) {
      const urlLine = text.split('\n').find(l => l.startsWith('URL:'));
      if (urlLine) result.url = urlLine.replace('URL:', '').trim();
    }

    const parsed = parseTrackContent(text);
    if (parsed.sections.length > 0) {
      result.tracks[track] = { label: TRACK_LABELS[track], ...parsed };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Plain-text context for RAG (unchanged)
// ---------------------------------------------------------------------------

function loadConcentrationContext(slug) {
  const parts = [];
  for (const track of ['ab', 'scb', 'general']) {
    const p = path.join(CONC_DIR, track, `${slug}.txt`);
    if (fs.existsSync(p)) parts.push(fs.readFileSync(p, 'utf8').trim());
  }
  return parts.length ? parts.join('\n\n---\n\n') : null;
}

function detectConcentration(query) {
  const q = query.toLowerCase();
  const candidates = Object.keys(keywordIndex).sort((a, b) => b.length - a.length);
  for (const kw of candidates) {
    const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) return keywordIndex[kw];
  }
  return null;
}

function getConcentrationName(slug) { return slugToName[slug] || slug; }

module.exports = { detectConcentration, loadConcentrationContext, getConcentrationName, getConcentrationData };
