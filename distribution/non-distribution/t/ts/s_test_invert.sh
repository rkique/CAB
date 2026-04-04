#!/bin/bash
# This is a student test
# Using d/s_invert1.txt, inverts into a local index with the url
# 'word.golf'. Then, compares the result against d/s_invert2.txt.

T_FOLDER=${T_FOLDER:-}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

url="word.golf"

if $DIFF <(cat d/s_invert1.txt | ../c/invert.sh $url | sed 's/[[:space:]]//g' | sort) <(cat d/s_invert2.txt | sed 's/[[:space:]]//g' | sort) >&2;
then
    echo "$0 success: inverted indices are identical"
    exit 0
else
    echo "$0 failure: inverted indices are not identical"
    exit 1
fi