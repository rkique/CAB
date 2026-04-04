#!/bin/bash

# Combine terms to create n-grams (for n=1,2,3)
# Usage: ./combine.sh < terms > n-grams

mkfifo p1 p2 p3

#outer tee process subs for p1 and p2
#tail +2 : drop + shift by 1

tee >(tee p1 | tail +2 | paste <(cat p1) - | sed '/\t$/d') >(tee p2 | tail +2 | paste <(cat p2) - | tee p3 | cut -f 1 | tail +3 | paste <(cat p3) - | sed '/\t$/d') | cat

rm p1 p2 p3
