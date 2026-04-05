#!/bin/bash
# This is a student test

#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

output=$(c/query.js the of and | wc -l)

if [ "$output" -eq 0 ]; then
  echo "$0 success: stopword-only query handled"
  exit 0
else
  echo "$0 failure: stopword-only query produced output"
  exit 1
fi
