#!/bin/bash
# This is a student test

#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

if ! $DIFF \
  <(cat "$T_FOLDER"/d/d_merge_local.txt | c/merge.js "$T_FOLDER"/d/d_merge_global.txt) \
  <("$DIFF" "$T_FOLDER"/d/d_merge_expected.txt -) >&2;
then
  echo "$0 failure: merge duplicate URL incorrect"
  exit 1
fi

echo "$0 success: merge duplicate URL correct"
exit 0
