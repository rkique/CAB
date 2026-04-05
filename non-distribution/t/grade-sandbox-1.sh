#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
EXIT=0

cat /dev/null >d/visited.txt
cat /dev/null >d/global-index.txt
echo https://cs.brown.edu/courses/csci1380/sandbox/1 >d/urls.txt

./engine.sh

ts=(
    "centuri instanc"
    "check stuff"
    "govern agenc research"
    "moscow west"
    "zone"
)
us=(
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1c/fact_6/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1b/fact_3/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1b/fact_4/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/level_2b/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/level_2a/index.html"
)
vs=(
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1a/level_2b/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1b/fact_3/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1c/fact_6/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/1/level_1b/index.html"
)


for t in "${ts[@]}"; do
    if grep -q "$t" d/global-index.txt;
    then
        true
    else
        echo "$0 failure: $t not in global index" >&2
        EXIT=1
    fi
done

for u in "${us[@]}"; do
    if grep -q "$u" d/global-index.txt;
    then
        true
    else
        echo "$0 failure: $u not in global index" >&2
        EXIT=1
    fi
done

for v in "${vs[@]}"; do
    if grep -q "$v" d/visited.txt;
    then
	true
    else
        echo "$0 failure: $v not in visited urls" >&2
        EXIT=1
    fi
done

if [ $EXIT -eq 0 ]; then
    echo "$0 success: all tests passed"
fi
exit $EXIT
