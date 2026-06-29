Plan

CAB is the primary corpus. We will turn the existing scripts into a repeatable course-search pipeline: 
fetch CAB data, 
normalize it into a stable document schema
distribute indexing
serve ranked course search results with evaluation baked in.

Define the CAB document model first: one document per course section with stable identifiers plus title, code, CRN, semester, instructor, meeting info, seat counts, description text, and any extra metadata that helps ranking or display.

Refactor ingestion into stages: keep CAB API access separate from normalization so the fetcher can be rerun independently, resumed from checkpoints, and retried without duplicating work.

Turn the HTML parsing into a deterministic normalization pass: preserve raw CAB payloads, extract clean text and structured fields, and make the output suitable for indexing and debugging.

Build the distributed indexing path: shard normalized course records, create inverted indexes and ranking features, and store them in the distributed key-value layer so queries stay fast and scalable.

Add the query layer: support text search over CAB courses, rank by a simple but explainable scoring model, and return snippets or field-level contributions for debugging and presentation.

Add evaluation support: define small correctness checks on hand-labeled CAB samples plus performance benchmarks for ingestion time, index build time, and query latency.

Add project documentation: record corpus scope, API assumptions, and evaluation notes in a top-level README or a separate planning doc for the poster and report.
Relevant files

getCoursesFancyNoFail.py — best base for resumable CAB fetching and retry handling.
getCourseInfoFancy.py — simpler async fetch baseline.
getCourseInfo.py — synchronous reference for API behavior.
parseCourses.py — normalization and text extraction stage.
import%20json.py — ad hoc recovery logic that can inform edge-case handling.
