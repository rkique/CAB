#!/bin/bash

R_FOLDER=${R_FOLDER:-}
S_FOLDER=${S_FOLDER:-s}

cd "$(dirname "$0")/..$R_FOLDER" || exit 1

if "$S_FOLDER"/lint.sh >&2; then
	echo "$0 success: no linting errors"
	exit 0
else
	echo "$0 failure: linting errors"
	exit 1
fi
