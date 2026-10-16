#!/bin/zsh
# Round 18 builder: every timing-sensitive (real-time) script one at a time, after the deterministic batch.
cd "$(dirname "$0")"
while ! grep -q DETDONE det18.log; do sleep 5; done
A=89101,27874,55752,43564,41272,12810,42547,41570,99586,49549,64360,47096
echo "START acc-low $(date +%T)"; LINE=low SEEDS=$A SIMT=600 node route-play-rt-x-m-esc17.mjs > acc-low.log 2>&1
echo "START acc-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$A SIMT=600 node balance-probe-m-esc17.mjs > acc-lazy.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START lazy-gates $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-esc17.mjs > m-lazy-a.log 2>&1
echo "START rep $(date +%T)"; [ -f rep-seeds.txt ] && LINE=low SEEDS=$(cat rep-seeds.txt) SIMT=600 node route-play-rt-x-m-esc17.mjs > rep-low.log 2>&1
echo "ALLDONE $(date +%T)"
