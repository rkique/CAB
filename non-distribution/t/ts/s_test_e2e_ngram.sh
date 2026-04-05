#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

rm -f d/global-index.txt

tmp=$(mktemp)

cat "$T_FOLDER"/d/d_e2e_ngram.html \
| c/getText.js \
| c/process.sh \
| c/stem.js \
| c/combine.sh \
| c/invert.sh url1 \
| c/merge.js d/global-index.txt \
> "$tmp" d/global-index.txt

mv "$tmp" d/global-index.txt

if ! $DIFF \
  <(c/query.js Fast Running | grep "fast run") \
  <("$DIFF" "$T_FOLDER"/d/d_e2e_ngram_expected.txt -) >&2;
then
  echo "$0 failure: bigram normalization/query incorrect"
  exit 1
fi

echo "$0 success: n-gram pipeline works"
exit 0
