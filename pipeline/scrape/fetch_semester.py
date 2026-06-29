#!/usr/bin/env python3
"""
Fetch course listings for a single semester from CAB and append to courses_overview.json.

Usage:
    python fetch_semester.py 202720        # Spring 2027
    python fetch_semester.py 202710        # Fall 2027
"""

import json
import sys
import ssl
import asyncio
import certifi
import aiohttp
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
COURSES_FILE = DATA_DIR / "courses_overview.json"

async def fetch_semester(srcdb):
    url = "https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N"
    payload = {
        "other": {"srcdb": srcdb},
        "criteria": [
            {"field": "is_ind_study", "value": "N"},
            {"field": "is_canc", "value": "N"},
        ],
    }
    headers = {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "x-requested-with": "XMLHttpRequest",
        "origin": "https://cab.brown.edu",
        "referer": "https://cab.brown.edu/",
    }

    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)

    async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
        async with session.post(url, json=payload) as resp:
            if resp.status != 200:
                print(f"Error: status {resp.status}")
                text = await resp.text()
                print(text[:500])
                return None
            data = await resp.json()
            results = data.get("results", [])
            print(f"Fetched {len(results)} courses for srcdb={srcdb}")
            return {"srcdb": srcdb, "results": results}


async def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_semester.py <srcdb>")
        print("  e.g. python fetch_semester.py 202720")
        sys.exit(1)

    srcdb = sys.argv[1]
    semester = fetch_semester(srcdb)
    result = await semester

    if result is None or len(result["results"]) == 0:
        print(f"No courses found for {srcdb}.")
        sys.exit(1)

    # Load existing data
    existing = json.loads(COURSES_FILE.read_text())

    # Check if srcdb already exists
    for i, sem in enumerate(existing):
        if sem["srcdb"] == srcdb:
            print(f"Replacing existing entry for {srcdb} ({len(sem['results'])} -> {len(result['results'])} courses)")
            existing[i] = result
            break
    else:
        print(f"Appending new semester {srcdb}")
        existing.append(result)

    COURSES_FILE.write_text(json.dumps(existing, indent=4))
    print(f"Updated {COURSES_FILE}")


if __name__ == "__main__":
    asyncio.run(main())
