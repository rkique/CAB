"""Utilities for CAB srcdb term codes: parsing, generation, and API probing."""

from __future__ import annotations

import ssl
import asyncio
from datetime import datetime, timezone
from typing import TypedDict

import certifi
import aiohttp

SEASON_MAP = {"00": "Summer", "10": "Fall", "15": "Winter", "20": "Spring"}
SEASON_ORDER = ["00", "10", "15", "20"]

CAB_API_URL = "https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N"
CAB_HEADERS = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "x-requested-with": "XMLHttpRequest",
    "origin": "https://cab.brown.edu",
    "referer": "https://cab.brown.edu/",
}

PROBE_CONCURRENCY = 10


class SrcdbInfo(TypedDict):
    year: int
    season_code: str
    season: str
    label: str


class ProbeResult(TypedDict):
    srcdb: str
    exists: bool
    course_count: int


def parse(srcdb: str) -> SrcdbInfo:
    year = int(srcdb[:4])
    code = srcdb[4:]
    season = SEASON_MAP.get(code, "Unknown")
    return {"year": year, "season_code": code, "season": season, "label": f"{season} {year}"}


def generate_candidates(start_year: int, end_year: int) -> list[str]:
    out: list[str] = []
    for y in range(start_year, end_year + 1):
        for code in SEASON_ORDER:
            out.append(f"{y}{code}")
    return out


def current_academic_year() -> int:
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 8 else now.year - 1


def identify_current_terms(valid_srcdbs: list[str]) -> list[str]:
    """Return the current and next semester from a list of valid srcdbs."""
    now = datetime.now(timezone.utc)
    ay = current_academic_year()

    # Academic calendar ordering within an academic year:
    #   Summer (ay, 00) → Fall (ay, 10) → Winter (ay, 15) → Spring (ay+1, 20)
    # Determine where we are and pick current + next.
    month = now.month
    if month >= 8:
        current_srcdb = f"{ay}10"      # Fall
        next_srcdb = f"{ay + 1}20"     # Spring
    elif month >= 5:
        current_srcdb = f"{ay + 1}00"  # Summer
        next_srcdb = f"{ay + 1}10"     # Fall
    elif month >= 1:
        current_srcdb = f"{ay}20"      # Spring  (ay here = previous fall's year)
        next_srcdb = f"{ay + 1}00"     # Summer
    else:
        current_srcdb = f"{ay}10"
        next_srcdb = f"{ay + 1}20"

    valid_set = set(valid_srcdbs)
    return [s for s in [current_srcdb, next_srcdb] if s in valid_set]


async def probe(session: aiohttp.ClientSession, srcdb: str) -> ProbeResult:
    payload = {
        "other": {"srcdb": srcdb},
        "criteria": [
            {"field": "is_ind_study", "value": "N"},
            {"field": "is_canc", "value": "N"},
        ],
    }
    try:
        async with session.post(CAB_API_URL, json=payload) as resp:
            if resp.status != 200:
                return {"srcdb": srcdb, "exists": False, "course_count": 0}
            data = await resp.json()
            results = data.get("results", [])
            return {"srcdb": srcdb, "exists": len(results) > 0, "course_count": len(results)}
    except Exception:
        return {"srcdb": srcdb, "exists": False, "course_count": 0}


async def discover(start_year: int | None = None, end_year: int | None = None) -> list[ProbeResult]:
    """Probe the CAB API for all valid srcdb terms in the given year range."""
    ay = current_academic_year()
    if start_year is None:
        start_year = ay - 1
    if end_year is None:
        end_year = ay + 2

    candidates = generate_candidates(start_year, end_year)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)
    sem = asyncio.Semaphore(PROBE_CONCURRENCY)

    async def bounded_probe(session: aiohttp.ClientSession, srcdb: str) -> ProbeResult:
        async with sem:
            return await probe(session, srcdb)

    async with aiohttp.ClientSession(connector=conn, headers=CAB_HEADERS) as session:
        tasks = [bounded_probe(session, s) for s in candidates]
        results = await asyncio.gather(*tasks)

    found = [r for r in results if r["exists"]]
    found.sort(key=lambda r: r["srcdb"])
    return found
