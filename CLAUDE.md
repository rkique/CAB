# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comment Guidelines
- Default to writing NO comments.
- Do not explain what the code does (e.g., avoid restating variable assignments or basic flow).
- Only add a comment if the WHY is non-obvious (e.g., hidden constraints, subtle invariants, workarounds for bugs).

## Dev Commands

**Node requires v22.** Always `nvm use 22` before running any Node commands.

**Run locally (two terminals from repo root):**
```bash
# Terminal 1 — backend API
nvm use 22 && node backend/search-server.js --local

# Terminal 2 — frontend dev server (after backend prints "Search UI at http://localhost:3000")
cd client && nvm use 22 && npm run dev
```
Frontend dev server: http://localhost:5173 (Vite proxies `/search` → port 3000)

**Build React for production:**
```bash
cd client && npm run build   # outputs client/dist/
```

**Deploy:**
```bash
docker compose up --build
```

**Re-scrape concentration requirements:**
```bash
python3 pipeline/scrape/scrape_concentrations.py
# outputs to data/definitions/concentrations/{ab,scb,professional,general}/
```

**Re-embed courses** (only needed when course data changes):
```bash
node pipeline/embed/embed_courses.js
```

## Architecture

### Request flow
```
Browser → nginx (443) → [static files from client/dist/]
                      → proxy /search → Node (3000) → OpenAI embeddings
                                                     → FAISS local search
                                                     → OpenAI RAG response
```

### Backend (`backend/`)
- **`search-server.js`** — HTTP server, `search()` orchestrator, OpenAI client, pre-query rewrite (`preQueryReword`), startup sequence. Entry point: `node backend/search-server.js [--local]`
- **`cache.js`** — LRU result cache (30min TTL, 100 entries), in-flight dedup (thundering herd), concurrency limiter (max 3 parallel searches), rate limiter (250 req/day/IP), query logger
- **`localSearch.js`** — loads `data/embeddings.jsonl` + `data/courses_overview.json` into memory, builds FAISS `IndexFlatIP` in-process, exposes `searchFaissLocal()`. Registers FAISS fns on `globalThis` for distributed mode compatibility.
- **`distributedSearch.js`** — distributed map-reduce FAISS search via the `distribution` framework (CS1380 origin). Only used without `--local`. For the current 10K-course scale, local mode is faster.
- **`filters.js`** — filter validation, section-level matching, department-priority staging logic, `augmentDepartmentFilters` (infers dept codes from query text)
- **`prompts/pre_query.txt`** — system prompt for the pre-query LLM that extracts structured filters from natural language

### Pre-query pipeline
Each search call runs two LLM calls sequentially:
1. **Pre-query** (`gpt-5.4-mini`, JSON mode) — extracts filters (days, season, hours, ratings, etc.) and produces a cleaned semantic `rewordedQuery`. Instructor filters are stripped from FAISS but their name tokens are re-injected into the reworded query via `ensureSemanticCoverage`.
2. **RAG response** (`scripts/rag.js`) — receives top-40 filtered + top-40 unfiltered FAISS results, generates a cited natural-language answer.

### Filter fields
`days`, `season`, `year`, `permreq`, `cr_avg_hours`, `cr_max_hours`, `cr_course_avg`, `cr_prof_avg`, `cr_class_size`, `course_rating`, `professor_rating`, `average_hours`, `max_hours`, `instr`, `programs`

Department filters use a two-stage FAISS search: primary dept first, then fallback to broader results if top-K isn't filled.

### Frontend (`client/`)
Single-page React app (Vite + React 19). All logic is in `client/src/App.jsx`. No router — results mode is a local state toggle. Proxies `/search` to port 3000 in dev via `vite.config.js`.

### Data files (`data/`)
- `courses_overview.json` — ~131k section records (Summer 2016–Spring 2026)
- `embeddings.jsonl` — one 256-dim `text-embedding-3-small` vector per section, keyed `crn:srcdb`
- `current_courses.json` — current-semester subset
- `definitions/concentrations/{ab,scb,professional,general}/` — scraped concentration requirement pages, one `.txt` per concentration per track

### Docker
- **`Dockerfile`** — Node API only (`--local` mode, port 3000)
- **`Dockerfile.nginx`** — multi-stage: builds React → bakes `client/dist/` into nginx image
- **`docker-compose.local.yml`** — local dev override: moves nginx/certbot to `production` profile, exposes port 3000 directly

### Data pipeline (`pipeline/`)
One-time / on-demand scripts. See `pipeline/README.md` for the full order of operations. Not needed at runtime.
