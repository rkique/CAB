# Data Pipeline

Scripts for replicating the ingestion from raw course data to the embeddings used at runtime.

## Order of operations

1. **scrape/** — fetch raw course data from the registrar
   - `fetch_semester.py` — pull course list for a semester
   - `getCourseDescriptions.py` / `getCoursesFancyNoFail.py` — enrich with descriptions
   - `parseCourses.py` — normalise to JSON
   - `mergeDescriptions.js` — merge enriched descriptions into overview

2. **embed/** — build the FAISS index and supporting data files
   - `extract-current-courses.js` — filter to current semester
   - `shard_courses.js` — split courses for parallel embedding
   - `embed_courses.js` — call OpenAI embeddings API, write `data/embeddings.jsonl` + `data/idmap.json`

3. **benchmark/** — measure retrieval and cluster performance (optional)
   - `cloud_benchmark.js` — end-to-end latency on AWS
   - `m3_benchmark.js` — distribution layer benchmark (M3 milestone)
   - `run_node.js` — helper to spin up a single cluster node for testing

## Outputs (written to `data/`)
- `embeddings.jsonl` — one embedding vector per course
- `idmap.json` — maps FAISS integer IDs → course identifiers
- `courses_overview.json` — full course metadata
- `current_courses.json` — current-semester subset
