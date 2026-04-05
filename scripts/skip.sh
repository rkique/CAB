#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: ./skip.sh <milestone> [--undo]"
  echo "Example: ./skip.sh 3"
  echo "         ./skip.sh 3 --undo"
  exit 1
}

undo="false"
if [ $# -eq 2 ] && [ "$2" = "--undo" ]; then
  undo="true"
elif [ $# -ne 1 ]; then
  usage
fi

case "$1" in
  3|m3|M3)
    ;;
  *)
    echo "[skip] Only milestone 3 overrides are supported right now."
    exit 1
    ;;
esac

top=$(git rev-parse --show-toplevel)
cd "$top" || exit 1

file="distribution.js"

if [ ! -f "$file" ]; then
  echo "[skip] $file not found"
  exit 1
fi

if [ "$undo" = "true" ]; then
  if rg -q "^[[:space:]]*/\\* __start_M3_solution__" "$file"; then
    echo "[skip] Overrides already disabled."
    git diff -- "$file"
    exit 0
  fi

  sed -E -i.bak \
    -e 's@^([[:space:]]*)// __start_M3_solution__@\1/* __start_M3_solution__@' \
    -e 's@^([[:space:]]*)// __end_M3_solution__@\1__end_M3_solution__ */@' \
    "$file"
  rm -f "$file.bak"

  echo "[skip] Disabled library overrides in $file"
  git diff -- "$file"
  exit 0
fi

if rg -q "^[[:space:]]*// __start_M3_solution__" "$file"; then
  echo "[skip] Overrides already enabled."
  git diff -- "$file"
  exit 0
fi

sed -E -i.bak \
  -e 's@^([[:space:]]*)/\* __start_M3_solution__@\1// __start_M3_solution__@' \
  -e 's@^([[:space:]]*)__end_M3_solution__ \*/@\1// __end_M3_solution__@' \
  "$file"
rm -f "$file.bak"

echo "[skip] Enabled library overrides in $file"
git diff -- "$file"
