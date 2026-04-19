#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GENERATED_DIR="$ROOT/scripts/benchmark/generated"
source "${AWS_VARS_FILE:-$GENERATED_DIR/aws-vars.generated.sh}"

SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new"

SYNC_CODE="${SYNC_CODE:-1}"
SYNC_COORD_DATA="${SYNC_COORD_DATA:-1}"

mkdir -p "$GENERATED_DIR"

if [[ -z "${COORD:-}" ]]; then
  echo "COORD is empty. Run generate_cluster_aws.py first."
  exit 1
fi

for HOST in "${ALL_HOSTS[@]}"; do
  if [[ -n "$HOST" ]]; then
    ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p $APP_DIR/data $APP_DIR/logs"
  fi
done

if [[ "$SYNC_CODE" == "1" ]]; then
  for HOST in "${ALL_HOSTS[@]}"; do
    if [[ -n "$HOST" ]]; then
      rsync -az --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude '.DS_Store' \
        --exclude 'store' \
        --exclude 'shards' \
        --exclude 'all_keys.json' \
        --exclude 'data/openai.key' \
        --exclude 'data/courses_overview.json' \
        --exclude 'data/embeddings.jsonl' \
        --exclude 'data/current_courses.json' \
        -e "$RSYNC_SSH" \
        "$ROOT/" "$HOST:$APP_DIR/"
    fi
  done
fi

for HOST in "${ALL_HOSTS[@]}"; do
  if [[ -n "$HOST" ]]; then
    scp "${SSH_OPTS[@]}" "$ROOT/cluster.aws.json" "$HOST:$APP_DIR/cluster.aws.json"
  fi
done

if [[ "$SYNC_COORD_DATA" == "1" ]]; then
  rsync -az -e "$RSYNC_SSH" "$ROOT/data/openai.key" "$COORD:$APP_DIR/data/openai.key"
  rsync -az -e "$RSYNC_SSH" "$ROOT/data/current_courses.json" "$COORD:$APP_DIR/data/current_courses.json"
  rsync -az -e "$RSYNC_SSH" "$ROOT/data/courses_overview.json" "$COORD:$APP_DIR/data/courses_overview.json"
  rsync -az -e "$RSYNC_SSH" "$ROOT/data/embeddings.jsonl" "$COORD:$APP_DIR/data/embeddings.jsonl"
fi

echo "Sync complete."