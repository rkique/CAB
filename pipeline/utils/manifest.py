"""Manifest management for tracking data freshness and embedding integrity."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
MANIFEST_PATH = DATA_DIR / "manifest.json"

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 256

# Fields to preserve from old records when CAB data is re-fetched
CR_FIELDS = frozenset({
    "cr_edition", "cr_professor", "cr_course_avg", "cr_prof_avg",
    "cr_avg_hours", "cr_max_hours", "cr_class_size", "cr_num_respondents",
    "cr_concs", "cr_nonconcs", "cr_frosh", "cr_soph", "cr_jun", "cr_sen",
    "cr_grad", "cr_grades", "cr_requirement", "cr_attendance",
    "course_rating", "professor_rating", "average_hours", "max_hours",
})


def _default_manifest() -> dict:
    return {
        "version": "1.0",
        "lastCheckedAt": None,
        "cab": {"srcdbs": {}},
        "embeddings": {
            "model": EMBEDDING_MODEL,
            "dimensions": EMBEDDING_DIMENSIONS,
            "records": {},
        },
        "criticalReview": {"enabled": False},
    }


def load() -> dict:
    if not MANIFEST_PATH.exists():
        return _default_manifest()
    try:
        return json.loads(MANIFEST_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        return _default_manifest()


def save(manifest: dict) -> None:
    manifest["lastCheckedAt"] = datetime.now(timezone.utc).isoformat()
    tmp = MANIFEST_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    os.replace(tmp, MANIFEST_PATH)


def _normalize_record(rec: dict) -> str:
    """Deterministic serialization of a course record for checksumming.

    Excludes volatile fields (enrollment counts, etc.) that shouldn't
    trigger a refresh. Keeps CR fields so their presence/absence is tracked.
    """
    return json.dumps(rec, sort_keys=True, separators=(",", ":"))


def compute_term_checksum(results: list[dict]) -> str:
    sorted_results = sorted(results, key=lambda r: r.get("crn", ""))
    blob = "\n".join(_normalize_record(r) for r in sorted_results)
    digest = hashlib.sha256(blob.encode()).hexdigest()
    return f"sha256:{digest}"


def term_changed(manifest: dict, srcdb: str, new_results: list[dict]) -> bool:
    entry = manifest["cab"]["srcdbs"].get(srcdb)
    if entry is None:
        return True
    new_checksum = compute_term_checksum(new_results)
    return new_checksum != entry.get("checksum")


def update_term(manifest: dict, srcdb: str, course_count: int, checksum: str) -> None:
    manifest["cab"]["srcdbs"][srcdb] = {
        "courseCount": course_count,
        "checksum": checksum,
        "lastFetchedAt": datetime.now(timezone.utc).isoformat(),
    }

def compute_text_hash(record: dict) -> str:
    """Hash the embedding text for a course record via CourseRecord model."""
    from .models import CourseRecord
    return CourseRecord.model_validate(record).text_hash()


def build_embedding_text(record: dict) -> str:
    """Build embedding text for a course record via CourseRecord model."""
    from .models import CourseRecord
    return CourseRecord.model_validate(record).embedding_text()


def should_reembed(manifest: dict, key: str, record: dict) -> bool:
    records = manifest.get("embeddings", {}).get("records", {})
    rec = records.get(key)
    if rec is None:
        return True
    emb = manifest.get("embeddings", {})
    if emb.get("model") != EMBEDDING_MODEL or emb.get("dimensions") != EMBEDDING_DIMENSIONS:
        return True
    current_hash = compute_text_hash(record)
    return current_hash != rec.get("textHash")


def update_embedding_record(manifest: dict, key: str, text_hash: str) -> None:
    manifest["embeddings"]["records"][key] = {
        "textHash": text_hash,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


def preserve_cr_fields(old_record: dict, new_record: dict) -> dict:
    """Copy Critical Review fields from old record into new record."""
    for field in CR_FIELDS:
        if field in old_record and field not in new_record:
            new_record[field] = old_record[field]
    return new_record
