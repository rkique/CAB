#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / "scripts" / "benchmark" / "results"
RAW = RESULTS_DIR / "raw_scale_results.csv"
SUMMARY = RESULTS_DIR / "summary_scale_results.csv"


def main() -> None:
    raw_df = pd.read_csv(RAW)
    summary_df = pd.read_csv(SUMMARY)

    # 1. Mean end-to-end latency with std error bars
    latency = (
        raw_df.groupby("workers")["wall_latency_s"]
        .agg(["mean", "std"])
        .reset_index()
    )

    plt.figure(figsize=(6, 4))
    plt.errorbar(latency["workers"], latency["mean"], yerr=latency["std"], marker="o")
    plt.xlabel("Number of workers")
    plt.ylabel("Average end-to-end latency (s)")
    plt.title("End-to-end query latency vs worker count")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "latency_vs_workers.png", dpi=200)
    plt.close()

    # 2. P95 latency
    p95 = (
        summary_df.groupby("workers")["p95_latency_s"]
        .mean()
        .reset_index()
    )

    plt.figure(figsize=(6, 4))
    plt.plot(p95["workers"], p95["p95_latency_s"], marker="o")
    plt.xlabel("Number of workers")
    plt.ylabel("P95 latency (s)")
    plt.title("P95 query latency vs worker count")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "p95_latency_vs_workers.png", dpi=200)
    plt.close()

    # 3. Throughput from actual batch wall-clock workload time
    throughput = (
        summary_df.groupby("workers")["queries_per_second"]
        .agg(["mean", "std"])
        .reset_index()
    )

    plt.figure(figsize=(6, 4))
    plt.errorbar(throughput["workers"], throughput["mean"], yerr=throughput["std"], marker="o")
    plt.xlabel("Number of workers")
    plt.ylabel("Queries / second")
    plt.title("Full-pipeline throughput vs worker count")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "throughput_vs_workers.png", dpi=200)
    plt.close()

    # 4. Startup time
    startup = (
        summary_df.groupby("workers")["startup_s"]
        .agg(["mean", "std"])
        .reset_index()
    )

    plt.figure(figsize=(6, 4))
    plt.errorbar(startup["workers"], startup["mean"], yerr=startup["std"], marker="o")
    plt.xlabel("Number of workers")
    plt.ylabel("Startup + health time (s)")
    plt.title("Cluster startup time vs worker count")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "startup_vs_workers.png", dpi=200)
    plt.close()

    # 5. Per-query latency boxplot
    workers_sorted = sorted(raw_df["workers"].unique())
    data = [raw_df.loc[raw_df["workers"] == w, "wall_latency_s"].values for w in workers_sorted]

    plt.figure(figsize=(7, 4))
    plt.boxplot(data, tick_labels=workers_sorted)
    plt.xlabel("Number of workers")
    plt.ylabel("End-to-end latency (s)")
    plt.title("Latency distribution by worker count")
    plt.tight_layout()
    plt.savefig(RESULTS_DIR / "latency_boxplot_by_workers.png", dpi=200)
    plt.close()

    print(f"Saved plots under {RESULTS_DIR}")


if __name__ == "__main__":
    main()