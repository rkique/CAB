#!/usr/bin/env bash

top_level=$(git rev-parse --show-toplevel)
cd "$top_level" || exit 1

while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--fix)
            fix="yes"
            shift
            ;;
    esac
done

lint="npx eslint --ignore-path .gitignore --config .eslintrc --rulesdir scripts/eslint-rules ."
[ -n "$fix" ] && lint="$lint --fix"

$lint

npx tsc
