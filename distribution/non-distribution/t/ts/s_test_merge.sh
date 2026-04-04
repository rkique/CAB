#!/bin/bash
# This is a student test
# Using d/s_merge1.txt and d/s_merge2.txt, combines them into a global index, referenced against d/s_merge3.txt.

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
DIFF_PERCENT=${DIFF_PERCENT:-0}

cat /dev/null > d/global-index.txt

files=(d/s_merge{1..2}.txt)

for file in "${files[@]}"
do
    cat "$file" | ../c/merge.js d/global-index.txt > d/temp-global-index.txt
    mv d/temp-global-index.txt d/global-index.txt
done

EXPECTED="meanings | word.golf 1 word.golf/help 1
neighbors | word.golf 4 word.golf/help 1
shouting | word.golf 3 word.golf/help 2
whisper | word.golf 2
word | word.golf 4"

ACTUAL=$(cat d/global-index.txt | sed 's/[[:space:]]*$//')

if [ "$EXPECTED" = "$ACTUAL" ];
then
    echo "$0 success: global index contents are correct"
    exit 0
else
    echo "$0 failure: global index contents do not match"
    echo "$EXPECTED" >&2
    echo "$ACTUAL" >&2
    exit 1
fi
