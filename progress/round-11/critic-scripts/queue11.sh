#!/bin/zsh
# Round 11 critic: every timing-sensitive script one at a time.
cd "$(dirname "$0")"
echo "START music desktop $(date +%T)"; TAP=1 LINE=low SEEDS=22,58,130 SIMT=400 node music-run11.mjs > music-d.log 2>&1
echo "START music mobile $(date +%T)"; TAP=1 MOBILE=1 LINE=low SEEDS=22 SIMT=400 node music-run11.mjs > music-m.log 2>&1
echo "START toggle $(date +%T)"; node toggle-test.mjs > toggle.log 2>&1
echo "START lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=400 node balance-probe-m.mjs > m-lazy.log 2>&1
echo "START high $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=400 node route-play-rt-x-m.mjs > m-high.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "ALLDONE $(date +%T)"
