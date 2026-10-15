#!/bin/zsh
# Round 17 builder: rest of the real-time queue, one at a time (waits for the acc-low street run to finish).
cd "$(dirname "$0")"
while pgrep -f "node route-play-rt-x-m-esc.mjs" > /dev/null; do sleep 3; done
F=32124,14545,97836,48947,96635,97214,79278,59437,29130,30593,32429,93049
echo "START acc-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$F SIMT=600 node balance-probe-m-esc.mjs > acc-lazy.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START rep $(date +%T)"; LINE=low SEEDS=${REP:-93049,29130,93049,29130} SIMT=600 node route-play-rt-x-m-esc.mjs > rep-low.log 2>&1
echo "ALLDONE $(date +%T)"
