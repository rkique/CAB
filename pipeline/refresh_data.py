#!/usr/bin/env python3
"""
Refresh CAB course data: discover terms, fetch changes, embed, rebuild derived files.

Usage:
    python3 pipeline/refresh_data.py --dry-run
    python3 pipeline/refresh_data.py --apply
    python3 pipeline/refresh_data.py --apply --force-term 202720
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
COURSES_FILE = DATA_DIR / "courses_overview.json"

sys.path.insert(0, str(ROOT / "pipeline"))
from scrape.fetch_semester import fetch_semester  # noqa: E402
from utils import manifest, srcdb  # noqa: E402


def load_courses() -> list[dict]:
    return json.loads(COURSES_FILE.read_text())


def save_courses(data: list[dict]) -> None:
    tmp = COURSES_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=4))
    os.replace(tmp, COURSES_FILE)


def build_cr_index(semesters: list[dict]) -> dict[str, dict]:
    """Build crn:srcdb → record map for preserving Critical Review fields."""
    idx: dict[str, dict] = {}
    for sem in semesters:
        for rec in sem.get("results", []):
            key = f"{rec.get('crn')}:{sem['srcdb']}"
            if any(f in rec for f in manifest.CR_FIELDS):
                idx[key] = rec
    return idx


def merge_changed_terms(
    existing: list[dict],
    changed: dict[str, dict],
    cr_index: dict[str, dict],
) -> list[dict]:
    """Replace or append changed terms, preserving CR fields."""
    by_srcdb = {sem["srcdb"]: sem for sem in existing}
    for term_srcdb, new_sem in changed.items():
        # Preserve CR fields from old records
        for rec in new_sem.get("results", []):
            key = f"{rec.get('crn')}:{term_srcdb}"
            old = cr_index.get(key)
            if old:
                manifest.preserve_cr_fields(old, rec)
        by_srcdb[term_srcdb] = new_sem

    return sorted(by_srcdb.values(), key=lambda s: s["srcdb"])


async def fetch_if_changed(
    term_srcdb: str,
    mf: dict,
    dry_run: bool,
) -> tuple[bool, dict | None]:
    result = await fetch_semester(term_srcdb)
    if result is None or len(result.get("results", [])) == 0:
        print(f"  ⚠ {term_srcdb}: no data returned, skipping")
        return False, None

    results = result["results"]
    if not manifest.term_changed(mf, term_srcdb, results):
        info = srcdb.parse(term_srcdb)
        print(f"  {info['label']}: unchanged ({len(results)} courses)")
        return False, None

    info = srcdb.parse(term_srcdb)
    old_entry = mf["cab"]["srcdbs"].get(term_srcdb)
    old_count = old_entry["courseCount"] if old_entry else 0
    print(f"  {info['label']}: changed ({old_count} → {len(results)} courses)")

    if dry_run:
        return True, None
    return True, result


def determine_refresh_set(
    valid_srcdbs: list[str],
    current_terms: list[str],
    mf: dict,
    force_term: str | None,
) -> list[str]:
    if force_term:
        return [force_term]

    known = set(mf["cab"]["srcdbs"].keys())
    missing = [s for s in valid_srcdbs if s not in known]
    # Always re-check current terms
    recheck = [s for s in current_terms if s not in missing]
    refresh = sorted(set(missing + recheck))
    return refresh


def run_node_script(script: str, label: str) -> bool:
    print(f"\n→ {label}")
    result = subprocess.run(
        ["node", str(ROOT / script)],
        cwd=str(ROOT),
    )
    if result.returncode != 0:
        print(f"  ✗ {label} failed (exit {result.returncode})")
        return False
    print(f"  ✓ {label} complete")
    return True


async def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh CAB course data")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Show what would change")
    mode.add_argument("--apply", action="store_true", help="Apply changes")
    parser.add_argument("--force-term", type=str, help="Force refresh a specific srcdb")
    args = parser.parse_args()

    dry_run = args.dry_run

    # Load manifest and existing data
    mf = manifest.load()
    existing = load_courses()
    existing_srcdbs = {sem["srcdb"] for sem in existing}
    print(f"Loaded {len(existing)} semesters, {sum(len(s.get('results', [])) for s in existing)} total sections")

    # Discover valid terms
    print("\nDiscovering terms...")
    found = await srcdb.discover()
    valid_srcdbs = [r["srcdb"] for r in found]
    print(f"Found {len(found)} valid terms: {', '.join(srcdb.parse(s)['label'] for s in valid_srcdbs)}")

    # Identify current terms
    current_terms = srcdb.identify_current_terms(valid_srcdbs)
    print(f"Current/upcoming: {', '.join(srcdb.parse(s)['label'] for s in current_terms)}")

    # Determine what to refresh
    refresh_set = determine_refresh_set(valid_srcdbs, current_terms, mf, args.force_term)
    if not refresh_set:
        print("\nNo terms need refreshing.")
        return
    print(f"\nChecking {len(refresh_set)} term(s): {', '.join(refresh_set)}")

    # Fetch and check each term
    changed: dict[str, dict] = {}
    unchanged_count = 0
    for term_srcdb in refresh_set:
        did_change, data = await fetch_if_changed(term_srcdb, mf, dry_run)
        if did_change and data is not None:
            changed[term_srcdb] = data
        elif not did_change:
            unchanged_count += 1

    # Summary
    if dry_run:
        print(f"\n[DRY RUN] Would update terms shown above. No files modified.")
        return

    if not changed:
        print("\nAll terms up to date. No changes needed.")
        # Still update manifest timestamps
        manifest.save(mf)
        return

    # Merge and write
    print(f"\nApplying {len(changed)} term update(s)...")
    cr_index = build_cr_index(existing)
    merged = merge_changed_terms(existing, changed, cr_index)
    save_courses(merged)
    print(f"Wrote {COURSES_FILE.name} ({len(merged)} semesters)")

    # Update manifest with checksums
    for term_srcdb, sem_data in changed.items():
        results = sem_data["results"]
        checksum = manifest.compute_term_checksum(results)
        manifest.update_term(mf, term_srcdb, len(results), checksum)
    manifest.save(mf)
    print(f"Wrote {manifest.MANIFEST_PATH.name}")

    # Run embedding script
    run_node_script("pipeline/embed/embed_courses.js", "Embedding new/changed courses")

    # Run extract-current-courses
    run_node_script("pipeline/embed/extract-current-courses.js", "Extracting current courses")

    # Final summary
    total_sections = sum(len(s.get("results", [])) for s in merged)
    print(f"\nRefresh complete: {len(changed)} term(s) updated, {total_sections} total sections")


if __name__ == "__main__":
    asyncio.run(main())
