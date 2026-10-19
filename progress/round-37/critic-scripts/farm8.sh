#!/bin/zsh
# Round 13 critic: the 8 farm-probe rows from round 12 (deterministic advance-based, 4 at a time).
cd "$(dirname "$0")"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1; }
run 22 66 6.5 & run 22 -22 6.5 & run 22 66 5 & run 58 66 6.5 & wait
run 58 22 5 & run 130 66 6.5 & run 130 22 6.5 & run 130 -66 6.5 & wait
SEED=22 SIMT=600 node farm-loop.mjs > farmloop-22.log 2>&1
echo DONE
