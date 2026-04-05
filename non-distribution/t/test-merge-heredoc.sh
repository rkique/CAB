#!/bin/bash

DIFF_PERCENT=${DIFF_PERCENT:-0}

# create file inline
LOCAL_INDEX_FILE="$(
cat << EOF
stuff level | 3 | https://cs.brown.edu/courses/csci1380/sandbox/1
simpl link | 1 | https://cs.brown.edu/courses/csci1380/sandbox/1
EOF
)"

INITIAL_GLOBAL_INDEX_FILE="$(
cat << EOF
stuff level | https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/index.html 2
EOF
)"

cd "$(dirname "$0")/.." || exit 1

NEW_GLOBAL_INDEX_FILE="$(
    echo "$LOCAL_INDEX_FILE" | ./c/merge.js <(echo "$INITIAL_GLOBAL_INDEX_FILE") | sort
)"

EXPECTED_GLOBAL_INDEX_FILE="$(
cat << EOF
simpl link | https://cs.brown.edu/courses/csci1380/sandbox/1 1
stuff level | https://cs.brown.edu/courses/csci1380/sandbox/1 3 https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/index.html 2
EOF
)"

if DIFF_PERCENT=$DIFF_PERCENT ./t/gi-diff.js <(echo "$NEW_GLOBAL_INDEX_FILE") <(echo "$EXPECTED_GLOBAL_INDEX_FILE") >&2
then
    echo "$0 success: global indexes are identical"
    exit 0
else
    echo "$0 failure: global indexes are not identical"
    exit 1
fi
