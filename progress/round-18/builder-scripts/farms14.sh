#!/bin/zsh
# Round 14 critic: every no-delivery farm from round 13 (deterministic, advance-based, 4 at a time).
cd "$(dirname "$0")"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1; }
sm() { SEED=$2 MODE=$1 ROADX=${3:-66} SIMT=600 node smart-farm.mjs > smart-$1-$2${3:+-$3}.log 2>&1; }
run 22 66 6.5 & run 22 -22 6.5 & run 22 66 5 & run 58 66 6.5 & wait
run 58 22 5 & run 130 66 6.5 & run 130 22 6.5 & run 130 -66 6.5 & wait
SEED=22 SIMT=600 node farm-loop.mjs > farmloop-22.log 2>&1 & sm near 22 & sm near 58 & sm near 130 & wait
sm line 22 & sm line 58 & sm line 130 & sm pickup 22 & wait
sm pickup 58 & sm pickup 130 & sm pickupline 22 66 & sm pickupline 22 -22 & wait
sm pickupline 58 66 & sm pickupline 58 -22 & sm pickupline 130 66 & sm pickupline 130 -22 & wait
sm spendpickup 22 66 & sm spendpickup 22 -22 & sm spendpickup 58 66 & sm spendpickup 58 -22 & wait
sm spendpickup 130 66 & sm spendpickup 130 -22 & wait
echo DONE
