#!/bin/bash

# index.sh runs the core indexing pipeline.

cat "$1" |
  c/process.sh |
  c/stem.js |
  c/combine.sh |
  c/invert.sh "$2" |
  c/merge.js d/global-index.txt |
  sort -o d/global-index.txt
