#!/usr/bin/env python3

# Fuzzy diff: compares two input files for approximate difference, as sets of
# lines; takes an onptional third argument of percent difference acceptable.

import sys, os

file1, file2 = sys.argv[1:]
tol = os.environ.get("DIFF_PERCENT", "25")

with open(file1) as f1, open(file2) as f2:
    s1 = {line.strip() for line in f1.readlines()}
    s2 = {line.strip() for line in f2.readlines()}

    diff = max(len(s1-s2), len(s2-s1))

    err = diff / len(s1)

    if err <= int(tol) / 100:
        exit(0)
    else:
        exit(1)
