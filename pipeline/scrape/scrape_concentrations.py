#!/usr/bin/env python3
"""
Scrape all Brown concentration requirement pages from bulletin.brown.edu.
Splits each page into degree-track sections and saves to:

  data/definitions/concentrations/ab/           — A.B. standard track
  data/definitions/concentrations/scb/          — Sc.B. standard track
  data/definitions/concentrations/professional/ — professional track add-ons
  data/definitions/concentrations/general/      — pages with no AB/ScB split

Usage: python3 pipeline/scrape/scrape_concentrations.py
"""

import re
import time
import pathlib
import warnings
import requests
from bs4 import BeautifulSoup, NavigableString, Tag

warnings.filterwarnings("ignore")

BASE = "https://bulletin.brown.edu"
INDEX_URL = f"{BASE}/the-college/concentrations/"
DATA_DIR = pathlib.Path(__file__).parent.parent.parent / "data" / "definitions" / "concentrations"

for sub in ("ab", "scb", "professional", "general"):
    (DATA_DIR / sub).mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers["User-Agent"] = "Mozilla/5.0 (BrunoRAG scraper)"
SESSION.verify = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_soup(url):
    r = SESSION.get(url, timeout=15)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")


def slug(path):
    """'/the-college/concentrations/ling/' -> 'ling'"""
    return [p for p in path.strip("/").split("/") if p][-1]


def el_to_text(el):
    """Render a single BS4 element as plain text."""
    tag = el.name if isinstance(el, Tag) else None
    if tag in ("h1", "h2", "h3", "h4"):
        t = el.get_text(" ", strip=True)
        bar = ("=" if tag in ("h1", "h2") else "-") * min(len(t), 72)
        return f"\n{bar}\n{t}\n{bar}"
    if tag == "p":
        return el.get_text(" ", strip=True)
    if tag in ("ul", "ol"):
        items = [f"  • {li.get_text(' ', strip=True)}" for li in el.find_all("li", recursive=False)]
        return "\n".join(items)
    if tag == "table":
        rows = []
        for row in el.find_all("tr"):
            cells = [td.get_text(" ", strip=True) for td in row.find_all(["th", "td"])]
            if any(cells):
                rows.append("  " + " | ".join(cells))
        return "\n" + "\n".join(rows) + "\n"
    return ""


def children_to_text(elements):
    parts = [el_to_text(el) for el in elements if isinstance(el, Tag)]
    text = "\n".join(p for p in parts if p)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# ---------------------------------------------------------------------------
# Section classifier
# ---------------------------------------------------------------------------

_AB_PAT = re.compile(r"\bA\.?B\.?\b|artium baccalaureus|bachelor of arts", re.I)
_SCB_PAT = re.compile(r"\bSc\.?B\.?\b|bachelor of science", re.I)
_PROF_PAT = re.compile(r"professional track", re.I)


def classify_heading(text):
    has_ab = bool(_AB_PAT.search(text))
    has_scb = bool(_SCB_PAT.search(text))
    has_prof = bool(_PROF_PAT.search(text))
    if has_prof:
        return "professional"
    if has_ab and not has_scb:
        return "ab"
    if has_scb and not has_ab:
        return "scb"
    if has_ab and has_scb:
        return "both"   # rare — treat as general
    return None


def split_into_tracks(main):
    """
    Walk top-level children of main, split on h2/h3 headings that signal
    a degree track.  Returns dict: track_name -> list of elements.
    """
    sections = {"ab": [], "scb": [], "professional": [], "general": []}
    current = "general"

    for child in main.children:
        if not isinstance(child, Tag):
            continue
        if child.name in ("h2", "h3"):
            heading_text = child.get_text(" ", strip=True)
            track = classify_heading(heading_text)
            if track and track != "both":
                current = track
            elif track == "both":
                current = "general"
            # Always include the heading in the current bucket
        sections[current].append(child)

    return sections


def save_section(name, url, track, elements, filename):
    text = children_to_text(elements)
    if not text or len(text) < 80:
        return False
    header = (
        f"CONCENTRATION: {name}\n"
        f"TRACK: {track.upper()}\n"
        f"URL: {url}\n"
        f"{'='*72}\n\n"
    )
    (DATA_DIR / track / filename).write_text(header + text, encoding="utf-8")
    return True


# ---------------------------------------------------------------------------
# Main scrape
# ---------------------------------------------------------------------------

def get_concentration_links():
    soup = get_soup(INDEX_URL)
    links = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.match(r"^/the-college/concentrations/[^/]+/?$", href):
            name = a.get_text(strip=True)
            if name and href not in links:
                links[href] = name
    return links


def scrape_concentration(path, name):
    url = BASE + path
    soup = get_soup(url)
    main = (
        soup.find(id="textcontainer")
        or soup.find(id="content")
        or soup.find(id="page-content")
        or soup.find("main")
        or soup.body
    )
    if not main:
        return {"error": "no main element"}

    sections = split_into_tracks(main)
    fname = slug(path) + ".txt"
    saved = {}

    for track, elements in sections.items():
        if elements:
            ok = save_section(name, url, track, elements, fname)
            if ok:
                saved[track] = fname

    return saved


def main():
    print("Fetching concentration index...")
    links = get_concentration_links()
    print(f"Found {len(links)} concentrations.\n")

    totals = {"ab": 0, "scb": 0, "professional": 0, "general": 0, "fail": 0}

    for path, name in sorted(links.items(), key=lambda x: x[1]):
        try:
            saved = scrape_concentration(path, name)
            tracks = ", ".join(saved.keys()) if saved else "—"
            print(f"  {name:50s} [{tracks}]")
            for t in saved:
                totals[t] += 1
        except Exception as e:
            print(f"  FAIL  {name:50s} {e}")
            totals["fail"] += 1
        time.sleep(0.3)

    print(f"\nDone:")
    for k, v in totals.items():
        if v:
            print(f"  {k:15s} {v} files")
    print(f"\nOutput: {DATA_DIR}")


if __name__ == "__main__":
    main()
