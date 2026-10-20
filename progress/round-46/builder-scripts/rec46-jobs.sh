#!/bin/zsh
# Round 46 builder: the six recording sessions, one browser at a time (dev server 5199).
cd "$(dirname "$0")"
echo "START $(date +%T)"
for T in classic breakbeat; do
  for M in main fx ot; do
    TRACK=$T MODE=$M node rec46b.mjs > rec46-$T-$M.log 2>&1; echo "$T $M $(date +%T) $(tail -1 rec46-$T-$M.log | cut -c1-200)"
  done
done
echo "ALLDONE $(date +%T)"
