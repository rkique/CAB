#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOSTS_PATH = ROOT / "scripts" / "benchmark" / "generated" / "aws_hosts.generated.json"
CLUSTER_PATH = ROOT / "cluster.aws.json"


def ssh(host: str, key: str, cmd: str, timeout: int = 20) -> None:
    result = subprocess.run(
        [
            "ssh",
            "-n",
            "-i",
            key,
            "-o",
            "StrictHostKeyChecking=accept-new",
            host,
            cmd,
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip())


def main() -> None:
    hosts = json.loads(HOSTS_PATH.read_text())
    cluster = json.loads(CLUSTER_PATH.read_text())

    key = hosts["ssh_key"]
    app_dir = hosts["app_dir"]

    worker_lookup = {w["name"]: w for w in hosts["workers"]}
    active_workers = cluster["workers"]

    for worker in active_workers:
        name = worker["name"]
        host = worker_lookup[name]["ssh_host"]

        cmd = (
            f"tmux kill-session -t {name} 2>/dev/null || true; "
            f"tmux new-session -d -s {name} "
            f"'cd {app_dir} && mkdir -p logs && "
            f"NODE_NAME={name} CLUSTER_CONFIG=./cluster.aws.json "
            f"node worker-server-faiss.js > logs/{name}.log 2>&1'"
        )

        ssh(host, key, cmd)
        print(f"Started {name} on {host}")
        time.sleep(1)

    coord_host = hosts["coordinator"]["ssh_host"]
    coord_cmd = (
        f"tmux kill-session -t coordinator 2>/dev/null || true; "
        f"tmux new-session -d -s coordinator "
        f"'cd {app_dir} && mkdir -p logs && "
        f"DEPLOY_MODE=distributed-aws CLUSTER_CONFIG=./cluster.aws.json "
        f"node frontend/search-server-distributed.js > logs/coordinator.log 2>&1'"
    )

    time.sleep(3)
    ssh(coord_host, key, coord_cmd)
    print(f"Started coordinator on {coord_host}")


if __name__ == "__main__":
    main()