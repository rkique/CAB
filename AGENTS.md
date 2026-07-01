# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Code Guidelines

- Use concise but understandable variable names. Do not leave verbose comments inline. Instead, spend time on function definitions and annotate with type where possible. Use type declarations in place of plain text descriptions.
- Default to writing NO comments. Only add a comment if the WHY is non-obvious (e.g., hidden constraints, subtle invariants, workarounds for bugs).
- When a comment is in place and appears to be handwritten, do not remove it.
- Prefer quality, simplicity, robustness, scalability, and long term maintainability over development cost.
- When doing bug fixes, always start with reproducing the bug closely aligned to how an end user will see it.
- When writing commit messages, never auto-add your agent name as a co-author.

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
- **`localSearch.js`** — loads `data/embeddings.jsonl` + `data/courses_overview.json` into memory, builds FAISS `IndexFlatIP` in-process, exposes `searchFaissLocal()`.
- **`filters.js`** — filter validation, section-level matching, department-priority staging logic, `augmentDepartmentFilters`

### Pre-query pipeline
Each search call runs two LLM calls sequentially:
1. **Pre-query** (JSON mode) — extracts filters and produces a cleaned semantic `rewordedQuery`.
2. **RAG response** (`scripts/rag.js`) — receives top-40 filtered + top-40 unfiltered FAISS results, generates a cited natural-language answer.

### Frontend (`client/`)
Single-page React app (Vite + React 19). All logic is in `client/src/App.jsx`. No router — results mode is a local state toggle. Proxies `/search` to port 3000 in dev via `vite.config.js`.

### Data files (`data/`)
- `courses_overview.json` — ~131k section records (Summer 2016–Spring 2026)
- `embeddings.jsonl` — one 256-dim `text-embedding-3-small` vector per section, keyed `crn:srcdb`
- `definitions/concentrations/` — scraped concentration requirement pages

### Docker
- **`Dockerfile`** — Node API only (`--local` mode, port 3000)
- **`Dockerfile.nginx`** — multi-stage: builds React → bakes `client/dist/` into nginx image
- **`docker-compose.local.yml`** — local dev override
