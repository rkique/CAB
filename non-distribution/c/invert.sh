#!/bin/bash

# Invert index to create a mapping from a term to all URLs containing the term.

# Usage: n-grams > ./invert.sh url

sort | uniq -c | awk '{print $2,$3,$4,"|",$1,"|"}' | sed 's/\s\+/ /g' | sort | sed "s|$| $1|"
