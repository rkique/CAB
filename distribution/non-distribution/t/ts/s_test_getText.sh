#!/bin/bash
# This is a student test
# Using the html body in d/s_getText1.txt,
# compares against the extracted text in d/s_getText2.txt 
# Note: headers are capitalized when using html-to-text.

T_FOLDER=${T_FOLDER:-}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}

if $DIFF <(cat d/s_getText1.txt | ../c/getText.js | sort) <(sort d/s_getText2.txt) >&2;
then
    echo "$0 success: texts are identical"
    exit 0
else
    echo "$0 failure: texts are not identical"
    exit 1
fi
