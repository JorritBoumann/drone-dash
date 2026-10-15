#!/bin/zsh
# Round 17 builder: timing-sensitive scripts one at a time, after the deterministic batch.
cd "$(dirname "$0")"
while ! grep -q DETDONE det17all.log; do sleep 5; done
F=32124,14545,97836,48947,96635,97214,79278,59437,29130,30593,32429,93049
echo "START acc-low $(date +%T)"; LINE=low SEEDS=$F SIMT=600 node route-play-rt-x-m-esc.mjs > acc-low.log 2>&1
echo "START acc-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$F SIMT=600 node balance-probe-m-esc.mjs > acc-lazy.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "ALLDONE $(date +%T)"
