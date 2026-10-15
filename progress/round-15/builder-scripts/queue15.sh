#!/bin/zsh
# Round 15 builder: every timing-sensitive script one at a time (copies of the round 14 critic scripts; outputs to
# ../builder-shots/). The *-e.mjs copies only add the escalation diagnostics to the MEDAL log line.
cd "$(dirname "$0")"
echo "START lowA $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-e.mjs > m-low-a.log 2>&1
echo "START lowB-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run-e.mjs > m-low-b.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-e.mjs > m-high-a.log 2>&1
echo "START highB $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-e.mjs > m-high-b.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-e.mjs > m-lazy-a.log 2>&1
echo "START lazyB $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-e.mjs > m-lazy-b.log 2>&1
echo "START rnd-low $(date +%T)"; LINE=low SEEDS=51334,19465,79373,85299 SIMT=600 node route-play-rt-x-m-e.mjs > r-low.log 2>&1
echo "START rnd-high $(date +%T)"; LINE=high SEEDS=51334,19465,79373,85299 SIMT=600 node route-play-rt-x-m-e.mjs > r-high.log 2>&1
echo "START rnd-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=51334,19465,79373,85299 SIMT=600 node balance-probe-m-e.mjs > r-lazy.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "ALLDONE $(date +%T)"
