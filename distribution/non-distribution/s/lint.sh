#!/bin/bash

cd "$(dirname "$0")"/.. || exit 1

LINT=0

for file in $(find . -name '*.sh' | grep -v -f .gitignore); do
    if shellcheck "$file"; then
	true
    else
	LINT=1
    fi
done

if npm run lint; then
	true
else
	LINT=1
fi

exit $LINT
