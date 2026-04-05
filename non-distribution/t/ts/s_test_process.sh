#!/bin/bash
# This is a student test

#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

if $DIFF \
  <(echo "©™ résumé café THE and OF" | c/process.sh) \
  <(printf "resume\ncafe\n") >&2;
then
  echo "$0 success: unicode processing correct"
  exit 0
else
  echo "$0 failure: unicode processing incorrect"
  exit 1
fi
