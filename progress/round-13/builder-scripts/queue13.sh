#!/bin/zsh
# Round 13 builder: timing-sensitive scripts one at a time (copies of the round 12 critic scripts, outputs to ../builder-shots/).
cd "$(dirname "$0")"
# lowA ran separately before this queue (m-low-a.log)
echo "START lowB-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run.mjs > m-low-b.log 2>&1
echo "START high $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m.mjs > m-high.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m.mjs > m-lazy-a.log 2>&1
echo "START lazyB $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m.mjs > m-lazy-b.log 2>&1
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "START mj-mobile $(date +%T)"; MOBILE=1 node medal-journey.mjs > mj-mobile.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "ALLDONE $(date +%T)"
