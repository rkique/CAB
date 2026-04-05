#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

rm -f d/global-index.txt

tmp=$(mktemp)

# Index document A
cat "$T_FOLDER"/d/d_e2e_docA.html \
| c/getText.js \
| c/process.sh \
| c/stem.js \
| c/invert.sh urlA \
| c/merge.js d/global-index.txt \
> "$tmp"

mv "$tmp" d/global-index.txt

# Index document B
tmp=$(mktemp)
cat "$T_FOLDER"/d/d_e2e_docB.html \
| c/getText.js \
| c/process.sh \
| c/stem.js \
| c/invert.sh urlB \
| c/merge.js d/global-index.txt \
> "$tmp"

mv "$tmp" d/global-index.txt 

# Query banana
if ! $DIFF \
  <(c/query.js banana | grep banana) \
  <("$DIFF" "$T_FOLDER"/d/d_e2e_expected_query.txt -) >&2;
then
  echo "$0 failure: incremental indexing incorrect"
  exit 1
fi

echo "$0 success: incremental indexing + query works"
exit 0
