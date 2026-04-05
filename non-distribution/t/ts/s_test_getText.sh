#!/bin/bash
# This is a student test


#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

if $DIFF \
  <(cat "$T_FOLDER"/d/d_nested.html | c/getText.js | sort) \
  <(sort "$T_FOLDER"/d/d_nested.txt) >&2;
then
  echo "$0 success: nested HTML handled correctly"
  exit 0
else
  echo "$0 failure: nested HTML incorrect"
  exit 1
fi
