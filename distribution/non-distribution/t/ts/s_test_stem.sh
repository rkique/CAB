#!/bin/bash
# This is a student test
# Stems the words in d/s_stem1.txt and compares them to the target labels in d/s_stem2.txt
T_FOLDER=${T_FOLDER:-}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat d/s_stem1.txt | ../c/stem.js | sort) <(sort d/s_stem2.txt) >&2;
then
    echo "$0 success: stemmed words are identical"
    exit 0
else
    echo "$0 failure: stemmed words are not identical"
    exit 1
fi