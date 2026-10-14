#!/bin/zsh
# Round 13 builder: the critic's 8 farm-probe rows plus farm-loop, SIMT 600. Deterministic sims (manualRender + advance).
cd "$(dirname "$0")"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1 }
run 22 66 6.5 & run 22 -22 6.5 & run 22 66 5 & run 58 66 6.5 & wait
run 58 22 5 & run 130 66 6.5 & run 130 22 6.5 & run 130 -66 6.5 & wait
SIMT=600 node farm-loop.mjs > farm-loop.log 2>&1
echo FARMDONE
