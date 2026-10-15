#!/bin/zsh
# Round 16 builder: timing-sensitive scripts one at a time. Fresh seeds from ../builder/fresh-seeds.txt (never tuned on).
cd "$(dirname "$0")"
F=38538,38820,80628,61714,48173,22265,36686,22415,26338,59413,25355,73421
L=../builder
echo "START fresh-low $(date +%T)"; LINE=low SEEDS=$F SIMT=600 node route-play-rt-x-m-esc.mjs > $L/f-low.log 2>&1
echo "START fresh-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$F SIMT=600 node balance-probe-m-esc.mjs > $L/f-lazy.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > $L/hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > $L/hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > $L/flat.log 2>&1
echo "START lowA-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run-esc.mjs > $L/m-low-a.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-esc.mjs > $L/m-lazy-a.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc.mjs > $L/m-high-a.log 2>&1
echo "ALLDONE $(date +%T)"
