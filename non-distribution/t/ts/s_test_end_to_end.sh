#!/bin/bash
# This is a student test

#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

if $DIFF \
  <(cat "$T_FOLDER"/d/d0.html | c/getText.js | c/process.sh | c/stem.js | sort) \
  <(sort "$T_FOLDER"/d/d_pipeline_expected.txt) >&2;
then
  echo "$0 success: pipeline works correctly"
  exit 0
else
  echo "$0 failure: pipeline incorrect"
  exit 1
fi
