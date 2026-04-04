#!/bin/bash
# This is a student test
#Using the text contents in d/s_getURLs1.txt, 
#compares against the links present in d/s_getURLs2.txt

T_FOLDER=${T_FOLDER:-}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

url=""

if ! $DIFF <(cat d/s_getURLs1.txt | ../c/getURLs.js "$url" | sort) <(sort d/s_getURLs2.txt) >&2;
then
    echo "$0 failure: URL sets are not identical"
    exit 1
fi
