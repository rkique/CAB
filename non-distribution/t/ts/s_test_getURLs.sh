#!/bin/bash
# This is a student test

#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

base="https://example.com/path/"

if ! $DIFF \
  <(cat "$T_FOLDER"/d/d_urls_mixed.html | c/getURLs.js $base | sort) \
  <(sort "$T_FOLDER"/d/d_urls_mixed.txt) >&2;
then
  echo "$0 failure: mixed URLs incorrect"
  exit 1
fi

echo "$0 success: mixed URLs handled correctly"
exit 0
