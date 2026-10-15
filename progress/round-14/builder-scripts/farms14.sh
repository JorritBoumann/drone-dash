#!/bin/zsh
# Round 14 builder: acceptance items 1 and 2. farm8 rows, farm-loop, and smart-farm modes on seeds 22, 58, 130 (4 at a time).
cd "$(dirname "$0")"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1; }
run 22 66 6.5 & run 22 -22 6.5 & run 22 66 5 & run 58 66 6.5 & wait
run 58 22 5 & run 130 66 6.5 & run 130 22 6.5 & run 130 -66 6.5 & wait
SEED=22 SIMT=600 node farm-loop.mjs > farmloop-22.log 2>&1 &
sf() { MODE=$1 SEED=$2 ROADX=$3 SIMT=600 node smart-farm.mjs > smart-$1-$2${3:+-$3}.log 2>&1; }
sf near 22 & sf near 58 & sf near 130 & wait
sf line 22 & sf line 58 & sf line 130 & sf pickupline 22 66 & wait
sf pickupline 58 66 & sf pickupline 130 66 & sf pickupline 22 -22 & sf pickupline 58 -22 & wait
sf pickupline 130 -22 & sf spendpickup 22 66 & sf spendpickup 58 66 & sf spendpickup 130 66 & wait
sf spendpickup 22 -22 & sf spendpickup 58 -22 & sf spendpickup 130 -22 & wait
echo DONE
