#!/bin/bash
#student test

DIFF_PERCENT=${DIFF_PERCENT:-0}

# create file inline
LOCAL_INDEX_FILE="$(
cat << EOF
language | 3 | https://eric-xia.com
art | 2 | https://eric-xia.com
EOF
)"

INITIAL_GLOBAL_INDEX_FILE="$(
cat << EOF
language | https://google.com 2
EOF
)"

cd "$(dirname "$0")/.." || exit 1

# Create temp file for initial index
echo "$INITIAL_GLOBAL_INDEX_FILE" > /tmp/initial_global_index.txt

NEW_GLOBAL_INDEX_FILE="$(
    echo "$LOCAL_INDEX_FILE" | ../c/merge.js /tmp/initial_global_index.txt | sort
)"

EXPECTED_GLOBAL_INDEX_FILE="$(
cat << EOF
art | https://eric-xia.com 2
language | https://eric-xia.com 3 https://google.com 2
EOF
)"

if DIFF_PERCENT=$DIFF_PERCENT node gi-diff.js <(echo "$NEW_GLOBAL_INDEX_FILE") <(echo "$EXPECTED_GLOBAL_INDEX_FILE") >&2
then
    echo "$0 success: global indexes are identical"
    exit 0
else
    echo "$0 failure: global indexes are not identical"
    exit 1
fi