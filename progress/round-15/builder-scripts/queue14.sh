#!/bin/zsh
# Round 14 critic: every timing-sensitive script one at a time. Scripts are copies of round 12 (outputs go to ../critic/).
cd "$(dirname "$0")"
echo "START lowA $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m.mjs > m-low-a.log 2>&1
echo "START lowB-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run.mjs > m-low-b.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m.mjs > m-high-a.log 2>&1
echo "START highB $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m.mjs > m-high-b.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m.mjs > m-lazy-a.log 2>&1
echo "START lazyB $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m.mjs > m-lazy-b.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "START mj-mobile $(date +%T)"; MOBILE=1 node medal-journey.mjs > mj-mobile.log 2>&1
echo "ALLDONE $(date +%T)"
