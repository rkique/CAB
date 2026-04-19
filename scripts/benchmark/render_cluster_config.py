from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[2]

BASE = {
    "gid": "courses",
    "coordinator": {
        "name": "cab-coordinator-1",
        "ip": "172.31.10.185",
        "distPort": 3001,
        "httpPort": 3000,
    },
    "workers": [
        {"name": "worker0", "ip": "172.31.4.201", "distPort": 3001},
        {"name": "worker1", "ip": "172.31.4.0", "distPort": 3001},
        {"name": "worker2", "ip": "172.31.8.44", "distPort": 3001},
        {"name": "worker3", "ip": "172.31.7.99", "distPort": 3001},
    ],
}

def main():
    k = int(sys.argv[1])
    out_path = ROOT / "cluster.generated.json"

    cfg = dict(BASE)
    cfg["workers"] = BASE["workers"][:k]

    with open(out_path, "w") as f:
        json.dump(cfg, f, indent=2)

    print(f"Wrote {out_path} with {k} workers")

if __name__ == "__main__":
    main()