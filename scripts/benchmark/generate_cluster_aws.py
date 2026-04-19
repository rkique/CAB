#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GENERATED_DIR = ROOT / "scripts" / "benchmark" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_REGION = os.environ.get("AWS_REGION", "us-east-2")
DEFAULT_PROJECT = os.environ.get("CAB_PROJECT_TAG", "CAB")
DEFAULT_SSH_USER = os.environ.get("CAB_SSH_USER", "ubuntu")
DEFAULT_KEY = os.environ.get("SSH_KEY_PATH", str(Path.home() / "Downloads" / "cab-dev-key.pem"))


def aws_ec2_json(args: list[str], region: str) -> dict:
    cmd = ["aws", "ec2"] + args + ["--region", region, "--output", "json"]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def fetch_instances(project_tag: str, region: str) -> list[dict]:
    data = aws_ec2_json(
        [
            "describe-instances",
            "--filters",
            f"Name=tag:Project,Values={project_tag}",
            "Name=instance-state-name,Values=running",
        ],
        region,
    )

    out = []
    for reservation in data.get("Reservations", []):
        for inst in reservation.get("Instances", []):
            tags = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
            out.append(
                {
                    "instance_id": inst["InstanceId"],
                    "private_ip": inst.get("PrivateIpAddress"),
                    "public_ip": inst.get("PublicIpAddress"),
                    "tags": tags,
                }
            )
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--region", default=DEFAULT_REGION)
    parser.add_argument("--project-tag", default=DEFAULT_PROJECT)
    parser.add_argument("--max-workers", type=int, default=None)
    parser.add_argument("--dist-port", type=int, default=3001)
    parser.add_argument("--http-port", type=int, default=3000)
    parser.add_argument("--ssh-user", default=DEFAULT_SSH_USER)
    parser.add_argument("--ssh-key", default=DEFAULT_KEY)
    parser.add_argument("--app-dir", default="~/CAB")
    args = parser.parse_args()

    instances = fetch_instances(args.project_tag, args.region)

    coordinators = []
    workers = []

    for inst in instances:
        role = inst["tags"].get("Role")
        if role == "coordinator":
            coordinators.append(inst)
        elif role == "worker":
            workers.append(inst)

    if len(coordinators) != 1:
        raise SystemExit(f"Expected exactly 1 running coordinator, found {len(coordinators)}")

    coordinator = coordinators[0]

    normalized_workers = []
    for w in workers:
        tags = w["tags"]
        if "WorkerIndex" not in tags:
            continue
        normalized_workers.append(
            {
                "name": f"worker{int(tags['WorkerIndex'])}",
                "worker_index": int(tags["WorkerIndex"]),
                "private_ip": w["private_ip"],
                "public_ip": w["public_ip"],
                "instance_id": w["instance_id"],
            }
        )

    normalized_workers.sort(key=lambda x: x["worker_index"])

    if args.max_workers is not None:
        normalized_workers = normalized_workers[: args.max_workers]

    cluster = {
        "gid": "courses",
        "coordinator": {
            "name": coordinator["tags"].get("Name", "cab-coordinator-1"),
            "ip": coordinator["private_ip"],
            "distPort": args.dist_port,
            "httpPort": args.http_port,
        },
        "workers": [
            {
                "name": w["name"],
                "ip": w["private_ip"],
                "distPort": args.dist_port,
            }
            for w in normalized_workers
        ],
    }

    hosts = {
        "region": args.region,
        "project_tag": args.project_tag,
        "ssh_user": args.ssh_user,
        "ssh_key": args.ssh_key,
        "app_dir": args.app_dir,
        "coordinator": {
            "name": coordinator["tags"].get("Name", "cab-coordinator-1"),
            "instance_id": coordinator["instance_id"],
            "private_ip": coordinator["private_ip"],
            "public_ip": coordinator["public_ip"],
            "ssh_host": f"{args.ssh_user}@{coordinator['public_ip']}" if coordinator["public_ip"] else None,
        },
        "workers": [
            {
                "name": w["name"],
                "worker_index": w["worker_index"],
                "instance_id": w["instance_id"],
                "private_ip": w["private_ip"],
                "public_ip": w["public_ip"],
                "ssh_host": f"{args.ssh_user}@{w['public_ip']}" if w["public_ip"] else None,
            }
            for w in normalized_workers
        ],
    }

    (ROOT / "cluster.aws.json").write_text(json.dumps(cluster, indent=2))
    (GENERATED_DIR / "aws_hosts.generated.json").write_text(json.dumps(hosts, indent=2))

    shell_lines = [
        "#!/usr/bin/env bash",
        f'export KEY="{args.ssh_key}"',
        f'export APP_DIR="{args.app_dir}"',
        f'export COORD="{hosts["coordinator"]["ssh_host"] or ""}"',
        "WORKER_NAMES=(" + " ".join(f'"{w["name"]}"' for w in hosts["workers"]) + ")",
        "WORKER_HOSTS=(" + " ".join(f'"{w["ssh_host"] or ""}"' for w in hosts["workers"]) + ")",
        'ALL_HOSTS=("$COORD" "${WORKER_HOSTS[@]}")',
    ]
    (GENERATED_DIR / "aws-vars.generated.sh").write_text("\n".join(shell_lines) + "\n")

    print(f"Wrote {ROOT / 'cluster.aws.json'}")
    print(f"Wrote {GENERATED_DIR / 'aws_hosts.generated.json'}")
    print(f"Wrote {GENERATED_DIR / 'aws-vars.generated.sh'}")
    print(f"Active workers in config: {len(hosts['workers'])}")
    if hosts["coordinator"]["public_ip"]:
        print(f"Coordinator URL: http://{hosts['coordinator']['public_ip']}:{args.http_port}/")


if __name__ == "__main__":
    main()