#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}


if $DIFF <(cat "$T_FOLDER"/d/d0.txt | c/getText.js | sort) <(sort "$T_FOLDER"/d/d2.txt) >&2;
then
    echo "$0 success: texts are identical"
    exit 0
else
    echo "$0 failure: texts are not identical"
    exit 1
fi
