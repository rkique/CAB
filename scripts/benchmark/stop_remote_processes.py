#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOSTS_PATH = ROOT / "scripts" / "benchmark" / "generated" / "aws_hosts.generated.json"


def ssh(host: str, key: str, cmd: str) -> None:
    result = subprocess.run(
        ["ssh", "-i", key, "-o", "StrictHostKeyChecking=accept-new", host, cmd],
        check=True,
        capture_output=True,
        text=True,
    )
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip())


def main() -> None:
    hosts = json.loads(HOSTS_PATH.read_text())
    key = hosts["ssh_key"]

    targets = []
    if hosts["coordinator"]["ssh_host"]:
        targets.append(hosts["coordinator"]["ssh_host"])
    for w in hosts["workers"]:
        if w["ssh_host"]:
            targets.append(w["ssh_host"])

    kill_cmd = (
        "tmux kill-session -t coordinator 2>/dev/null || true; "
        "tmux kill-session -t worker0 2>/dev/null || true; "
        "tmux kill-session -t worker1 2>/dev/null || true; "
        "tmux kill-session -t worker2 2>/dev/null || true; "
        "tmux kill-session -t worker3 2>/dev/null || true; "
        "pkill -f '[w]orker-server-faiss.js' || true; "
        "pkill -f '[f]rontend/search-server-distributed.js' || true; "
        "echo stopped"
    )

    for target in targets:
        ssh(target, key, kill_cmd)
        print(f"Stopped processes on {target}")


if __name__ == "__main__":
    main()