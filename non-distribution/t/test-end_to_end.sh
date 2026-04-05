#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
DIFF_PERCENT=${DIFF_PERCENT:-0}

cat /dev/null > d/visited.txt
cat /dev/null > d/global-index.txt

cat "$T_FOLDER"/d/u.txt > d/urls.txt

./engine.sh

EXIT=0

if $DIFF <(sort d/visited.txt) <(sort "$T_FOLDER"/d/v.txt) >&2;
then
    echo "$0 success: visited urls are identical"
else
    echo "$0 failure: visited urls are not identical"
    EXIT=1
fi

if DIFF_PERCENT=$DIFF_PERCENT t/gi-diff.js <(sort d/global-index.txt) <(sort "$T_FOLDER"/d/i.txt) >&2;
then
    echo "$0 success: global-index is identical"
else
    echo "$0 failure: global-index is not identical"
    EXIT=1
fi

exit $EXIT
