#!/bin/zsh
# Round 17 critic: every timing-sensitive script one at a time, after the deterministic batch.
cd "$(dirname "$0")"
while ! grep -q DETDONE det17.log; do sleep 5; done
A=55211,52809,95387,16805,14523,15493,88700,68665,65188,25215,83341,61719
echo "START acc-low $(date +%T)"; LINE=low SEEDS=$A SIMT=600 node route-play-rt-x-m-esc17.mjs > acc-low.log 2>&1
echo "START acc-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$A SIMT=600 node balance-probe-m-esc17.mjs > acc-lazy.log 2>&1
echo "START lowA-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run-esc.mjs > m-low-a.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc17.mjs > m-high-a.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-esc17.mjs > m-lazy-a.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "ALLDONE $(date +%T)"
