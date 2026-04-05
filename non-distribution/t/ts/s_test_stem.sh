#!/bin/bash
# This is a student test
#!/bin/bash
T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1
DIFF=${DIFF:-diff}

if $DIFF \
  <(printf "running\nruns\nrunner\n" | c/stem.js) \
  <(printf "run\nrun\nrunner\n") >&2;
then
  echo "$0 success: stemming correct"
  exit 0
else
  echo "$0 failure: stemming incorrect"
  exit 1
fi
