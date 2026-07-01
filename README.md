# BrunoRAG

**Live at [brunorag.com](https://brunorag.com)**

## Abstract

BrunoRAG is a search service that allows users to query for courses at Brown University using natural language. Queries are embedded with OpenAI `text-embedding-3-small` and matched against ~131k course section vectors via FAISS. A pre-query LLM extracts structured filters (days, hours, ratings, instructor, etc.) from the input, and a post-query LLM generates a cited natural-language answer from the top results.

## Data

Course data is collected from the Courses@Brown (CAB) API: ~131,000 section records spanning Summer 2016 through Spring 2026, representing ~10,000 unique offerings. Critical Review data from 2019–2025 is joined by CRN where available, providing course/professor ratings, workload hours, and class size.

A refresh pipeline (`pipeline/refresh_data.py`) discovers new CAB terms, fetches only changed data, preserves Critical Review fields, and regenerates stale embeddings automatically:

```bash
python3 pipeline/refresh_data.py --dry-run   # preview changes
python3 pipeline/refresh_data.py --apply      # fetch, embed, rebuild
```

## Supported Queries

A pre-query model automatically extracts filters from natural language. Example queries:

- like math 1530 but more chill
- drama intensive MWF 4+ instructor rating
- WRIT classes in economics
- english classes <10 hours/wk MWF
- TuTh systems-heavy CS courses
- Cities and urban architecture practicum

**Filterable fields:** department, days of the week, semester/year, permission required, average/max weekly hours, course rating, professor rating, class size, instructor name, concentration programs.

## Methodology

Each search request runs two LLM calls:

1. **Pre-query** (JSON mode) — extracts structured filters and produces a cleaned semantic query. Department filters use a two-stage FAISS search: primary department first, then fallback to broader results if top-K isn't filled.
2. **RAG response** — receives top-40 filtered and top-40 unfiltered FAISS results, generates a cited answer.

Course data is embedded as 256-dimensional vectors and indexed in a FAISS `IndexFlatIP` (cosine similarity) index loaded in-process at startup. An LRU cache (30min TTL, 100 entries) with in-flight deduplication serves repeated queries without re-running the pipeline.

## UI

The frontend is a single-page React app (Vite + React 19). Features:

- **Search bar** with example query cards on the landing page
- **"Only search Fall '26" toggle** for filtering to current-semester offerings
- **AI-generated answer** with inline course code links to CAB
- **Best Matches / Other Relevant Courses** split — cited courses appear first, with additional results below
- **Course cards** showing sections, schedules, instructor, ratings, and truncated descriptions
- **Concentration cards** when a query matches a concentration program
- **"What's being searched?" modal** showing data coverage details

