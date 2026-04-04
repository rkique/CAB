#!/bin/bash
# This is a student test
T_FOLDER=${T_FOLDER:-}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

EXPECTED=$(cat d/s_combine.txt | sort)

ACTUAL=$(echo -e "the\nquick\nbrown" | ../c/combine.sh | sort)


if $DIFF -w <(echo "$EXPECTED") <(echo "$ACTUAL") >&2;
then
    echo "$0 success: stemmed words are identical"
    exit 0
else
    echo "$0 failure: stemmed words are not identical"
    exit 1
fi