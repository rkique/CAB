#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import os
import statistics
import subprocess
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
QUERIES_PATH = ROOT / "scripts" / "benchmark" / "queries.json"
HOSTS_PATH = ROOT / "scripts" / "benchmark" / "generated" / "aws_hosts.generated.json"
RESULTS_DIR = ROOT / "scripts" / "benchmark" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Adjust these for your experiment
WORKER_COUNTS = [1, 2, 3]
TRIALS_PER_QUERY = 3
CLUSTER_REPEATS = 1   # set to 2 or 3 later for error bars
HEALTH_TIMEOUT_S = 900
WARMUP_QUERY = "computer science systems courses"


def run(cmd: list[str], env: dict | None = None) -> None:
    subprocess.run(cmd, check=True, env=env)


def wait_for_health(base_url: str, timeout_s: int) -> None:
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            r = requests.get(f"{base_url}/healthz", timeout=5)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError(f"Coordinator never became healthy at {base_url}")


def percentile(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    xs = sorted(values)
    idx = (len(xs) - 1) * p
    lo = int(idx)
    hi = min(lo + 1, len(xs) - 1)
    frac = idx - lo
    return xs[lo] * (1 - frac) + xs[hi] * frac


def measure_query(base_url: str, query: str) -> dict:
    t0 = time.perf_counter()
    resp = requests.post(f"{base_url}/search", json={"query": query}, timeout=180)
    wall_s = time.perf_counter() - t0
    resp.raise_for_status()
    payload = resp.json()

    return {
        "query": query,
        "wall_latency_s": wall_s,
        "reported_time_ms": payload.get("time_ms"),
        "num_results": len(payload.get("results", [])),
        "mode": payload.get("mode"),
    }


def main() -> None:
    queries = json.loads(QUERIES_PATH.read_text())
    raw_rows: list[dict] = []
    summary_rows: list[dict] = []

    for k in WORKER_COUNTS:
        for repeat in range(CLUSTER_REPEATS):
            print(f"\n=== Benchmarking with {k} workers | repeat {repeat} ===")

            gen_start = time.perf_counter()
            run([
                "python3",
                str(ROOT / "scripts" / "benchmark" / "generate_cluster_aws.py"),
                "--max-workers",
                str(k),
            ])

            env = os.environ.copy()
            env["SYNC_CODE"] = "1"
            env["SYNC_COORD_DATA"] = "1"
            run(["bash", str(ROOT / "scripts" / "benchmark" / "sync_cluster.sh")], env=env)

            run(["python3", str(ROOT / "scripts" / "benchmark" / "stop_remote_processes.py")])
            run(["python3", str(ROOT / "scripts" / "benchmark" / "start_remote_processes.py")])

            hosts = json.loads(HOSTS_PATH.read_text())
            coord_public = hosts["coordinator"]["public_ip"]
            base_url = f"http://{coord_public}:3000"

            wait_for_health(base_url, HEALTH_TIMEOUT_S)
            startup_s = time.perf_counter() - gen_start
            print(f"Startup+health time with {k} workers: {startup_s:.2f}s")

            # Warmup request, not counted
            try:
                requests.post(f"{base_url}/search", json={"query": WARMUP_QUERY}, timeout=180)
            except Exception as e:
                print(f"Warmup failed: {e}")

            workload_start = time.perf_counter()
            latencies: list[float] = []
            modes_seen: set[str] = set()

            for query in queries:
                for trial in range(TRIALS_PER_QUERY):
                    result = measure_query(base_url, query)
                    result["workers"] = k
                    result["repeat"] = repeat
                    result["trial"] = trial
                    result["startup_s"] = startup_s
                    raw_rows.append(result)

                    latencies.append(result["wall_latency_s"])
                    if result["mode"] is not None:
                        modes_seen.add(result["mode"])

                    print(
                        f"k={k} repeat={repeat} trial={trial} "
                        f"query={query!r} wall={result['wall_latency_s']:.3f}s"
                    )

            workload_total_s = time.perf_counter() - workload_start
            total_requests = len(queries) * TRIALS_PER_QUERY
            qps = total_requests / workload_total_s if workload_total_s > 0 else 0.0

            summary = {
                "workers": k,
                "repeat": repeat,
                "total_requests": total_requests,
                "workload_total_s": workload_total_s,
                "queries_per_second": qps,
                "startup_s": startup_s,
                "mean_latency_s": statistics.mean(latencies) if latencies else float("nan"),
                "std_latency_s": statistics.stdev(latencies) if len(latencies) > 1 else 0.0,
                "p50_latency_s": percentile(latencies, 0.50),
                "p95_latency_s": percentile(latencies, 0.95),
                "mode": ",".join(sorted(modes_seen)),
            }
            summary_rows.append(summary)

            print(
                f"Summary: workers={k} repeat={repeat} "
                f"qps={qps:.4f} mean={summary['mean_latency_s']:.3f}s "
                f"p95={summary['p95_latency_s']:.3f}s"
            )

            run(["python3", str(ROOT / "scripts" / "benchmark" / "stop_remote_processes.py")])

    raw_csv = RESULTS_DIR / "raw_scale_results.csv"
    with raw_csv.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=raw_rows[0].keys())
        writer.writeheader()
        writer.writerows(raw_rows)

    summary_csv = RESULTS_DIR / "summary_scale_results.csv"
    with summary_csv.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=summary_rows[0].keys())
        writer.writeheader()
        writer.writerows(summary_rows)

    print(f"\nSaved raw results to {raw_csv}")
    print(f"Saved summary results to {summary_csv}")


if __name__ == "__main__":
    main()