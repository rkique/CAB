# Data Freshness Automation Plan

## Goal

Keep BrunoRAG course data fresh when Brown releases new CAB terms or updates existing course records, while avoiding unnecessary full historical scrapes and unnecessary embedding regeneration.

Critical Review data is currently out of scope because the source is not reliably accessible. The pipeline should preserve existing Critical Review fields when present, but should not depend on new Critical Review ingestion for now.

## Current State

- `pipeline/scrape/fetch_semester.py` can fetch one CAB `srcdb` term and replace or append it in `data/courses_overview.json`.
- `pipeline/embed/embed_courses.js` is resume-safe by `crn:srcdb`; it appends missing embeddings and skips existing keys.
- `pipeline/embed/extract-current-courses.js` writes `data/current_courses.json`, but its target terms are hard-coded.
- Runtime local search loads `data/courses_overview.json` and `data/embeddings.jsonl`, then builds the FAISS index in process.
- The deploy workflow runs on pushes to `main`.

## Proposed Workflow

Add a single refresh command, for example:

```bash
python3 pipeline/refresh_data.py --dry-run
python3 pipeline/refresh_data.py --apply
```

The refresh command should:

1. Discover current and upcoming CAB `srcdb` terms.
2. Fetch only missing or changed terms.
3. Validate the updated course data.
4. Regenerate only missing or stale embeddings.
5. Rebuild derived data files.
6. Report a concise summary of changes.

## Manifest

Add `data/manifest.json` to track source freshness and prevent blind rewrites.

Suggested shape:

```json
{
  "lastCheckedAt": "2026-06-30T00:00:00.000Z",
  "cab": {
    "srcdbs": {
      "202610": {
        "courseCount": 1234,
        "checksum": "sha256:...",
        "lastFetchedAt": "2026-06-30T00:00:00.000Z"
      }
    }
  },
  "embeddings": {
    "model": "text-embedding-3-small",
    "dimensions": 256
  }
}
```

Each term checksum should be computed from the normalized term payload, not from pretty-printed JSON, so formatting changes do not trigger false positives.

## Course Fetching
Keep `fetch_semester.py` as the basic fetch primitive, but move toward an orchestrated workflow:
1. Probe candidate `srcdb`s.
2. Fetch missing terms.
3. Re-fetch known recent terms because CAB records may change after first release.
4. Compare fetched results with the manifest checksum.
5. Replace only terms whose normalized payload changed.
6. Write `courses_overview.json` in a deterministic order.
Recent terms should be rechecked more often than historical terms. Historical terms can be treated as immutable unless manually requested.

## Embedding Freshness
The current embedding script skips by `crn:srcdb`. That is enough for newly released sections, but it misses cases where an existing section's title or description changes.
Add an embedding manifest keyed by `crn:srcdb`, storing a hash of the exact text that was embedded:

```json
{
  "12345:202610": {
    "textHash": "sha256:...",
    "model": "text-embedding-3-small",
    "dimensions": 256
  }
}

```
Then update `embed_courses.js` so it skips a record only when:
- the embedding key exists
- the text hash matches
- the model matches
- the dimensions match

For stale records, either rewrite `embeddings.jsonl` atomically from the manifest or write a compacted replacement file after embedding changes. Avoid accumulating duplicate keys indefinitely.
## Derived Files
After accepted course or embedding changes, rebuild derived files:
```bash
node pipeline/embed/embed_courses.js
node pipeline/embed/extract-current-courses.js
```
If persisted local index artifacts are needed for debugging or deployment, also run:
```bash
node scripts/indexer.js
```
`extract-current-courses.js` should be changed to derive current/upcoming terms from the same `srcdb` utility instead of hard-coding `202610` and `202720`.

## Critical Review Data
Critical Review refresh is deferred.

For now:

- preserve existing `cr_*`, `course_rating`, `professor_rating`, `average_hours`, and `max_hours` fields when CAB data is rewritten
- do not fail the refresh if no Critical Review source is configured
- include a manifest section for future Critical Review metadata, but leave it disabled

Future support can be added as a source adapter that normalizes Critical Review data into records keyed preferably by `crn:srcdb`, with fallbacks such as `code + instructor + term` only if necessary.

Use one of two deployment-friendly automation paths.

## Recommended Implementation Order

1. Add `srcdb` discovery utilities.
2. Add `pipeline/refresh_data.py` with `--dry-run` and `--apply`.
3. Add `data/manifest.json`.
4. Make `extract-current-courses.js` use discovered current/upcoming terms.
5. Add embedding text hashes and stale embedding regeneration.

Validate by using API access to pull full refresh and update the embeddings if new courses released. Stick to the existing defaults to avoid rate limiting; try again when necessary.