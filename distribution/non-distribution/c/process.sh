#!/bin/bash

# Convert input to a stream of non-stopword terms
# Usage: input > ./process.sh > output
# convert non-letter characters to newlines
tr "©®™" "\n" | 
tr -C "[:alpha:]" "\n" |
#make lowercase
tr "[:upper:]" "[:lower:]"  |
#convert to ASCII
iconv -t UTF-8  |
#remove stopwords (inside d/stopwords.txt)
grep -vxf "$(dirname "$0")/../d/stopwords.txt" || true
# Non-letter characters include things like ©, ®, and ™ as well!
# Commands that will be useful: tr, iconv, grep
# Tip: Make sure your program doesn't emit a non-zero exit code if there are no words left after removing stopwords.
