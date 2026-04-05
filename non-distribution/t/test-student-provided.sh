#!/bin/bash

cd "$(dirname "$0")" || exit

components=(
	"combine.sh"
	"engine.sh"
	"getText.js"
	"getURLs.js"
	"invert.sh"
	"merge.js"
	"process.sh"
	"query.js"
	"stem.js"
)

N_S=0
N_T=5

MISSING_COMPONENTS=""
TESTED_COMPONENTS=""

for component in "${components[@]}"; do
	if grep -q "$component" <(cat ./ts/*.sh); then
		echo "$0 success: test-$component provided"
		N_S=$((N_S + 1))
		TESTED_COMPONENTS="$TESTED_COMPONENTS $component"
	else
		MISSING_COMPONENTS="$MISSING_COMPONENTS $component"
	fi
done

if [ "$N_S" -ge $N_T ]; then
	exit 0
else
	echo "$0 failed: less than $N_T component tests provided (found $N_S)" >&2
	echo "Found tests for components: $TESTED_COMPONENTS" >&2
	echo "Didn't find tests for components: $MISSING_COMPONENTS" >&2
	exit 1
fi
