#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
EXIT=0

cat /dev/null >d/visited.txt
cat /dev/null >d/global-index.txt
echo https://cs.brown.edu/courses/csci1380/sandbox/3 >d/urls.txt

./engine.sh

ts=(
    "wright"
    "basket artist"
    "head product"
    "heal"
    "read book english"
)
us=(
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/the-power-of-now-a-guide-to-spiritual-enlightenment_855/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/the-nicomachean-ethics_75/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/aladdin-and-his-wonderful-lamp_973/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/something-more-than-this_834/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/full-moon-over-noahs-ark-an-odyssey-to-mount-ararat-and-beyond_811/index.html"
)
vs=(
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/black-dust_976/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/modern-romance_820/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/raymie-nightingale_482/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/soumission_998/index.html"
    "https://cs.brown.edu/courses/csci1380/sandbox/3/catalogue/the-bear-and-the-piano_967/index.html"
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
