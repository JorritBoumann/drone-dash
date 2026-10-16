#!/bin/zsh
# Round 16 critic: every timing-sensitive script one at a time, after the deterministic batch. Scripts are copies of round 15 (outputs go to ../builder-shots/).
cd "$(dirname "$0")"
while ! grep -q DETDONE det16.log; do sleep 5; done
A=80258,40443,66012,97343,73243,12668,96842,54408,19093,84143,62367,36020
echo "START acc-low $(date +%T)"; LINE=low SEEDS=$A SIMT=600 node route-play-rt-x-m-esc.mjs > acc-low.log 2>&1
echo "START acc-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$A SIMT=600 node balance-probe-m-esc.mjs > acc-lazy.log 2>&1
echo "START lowA-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run-esc.mjs > m-low-a.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc.mjs > m-high-a.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-esc.mjs > m-lazy-a.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START looks $(date +%T)"; node looks16.mjs > looks16.log 2>&1
echo "ALLDONE $(date +%T)"
