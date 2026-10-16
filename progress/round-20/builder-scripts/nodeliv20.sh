#!/bin/zsh
# Round 20 builder: no-delivery farms (all must score 0) and one-delivery farms (capfarm both, FARMMAX 12: Bronze or below),
# deterministic, on 22, 58, 130.
cd "$(dirname "$0")"; O=../builder/nodeliv; mkdir -p $O
run() { SEED=$1 ROAD=$2 OFF=6.5 SIMT=600 nice -n 10 node farm-probe.mjs > $O/farm-$1-$2.log 2>&1; }
sm() { SEED=$2 MODE=$1 ROADX=${3:-66} SIMT=600 nice -n 10 node smart-farm.mjs > $O/smart-$1-$2.log 2>&1; }
one() { SEED=$1 MODE=both FARMMAX=12 SIMT=600 nice -n 10 node capfarm.mjs > $O/onedel-$1.log 2>&1; }
run 22 66 & run 58 66 & run 130 66 & SEED=22 SIMT=600 nice -n 10 node farm-loop.mjs > $O/farmloop-22.log 2>&1 & sm near 22 & sm pickupline 130 & wait
one 22 & one 58 & one 130 & wait
echo DONE
