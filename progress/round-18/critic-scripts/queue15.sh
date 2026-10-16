#!/bin/zsh
# Round 15 critic: every timing-sensitive script one at a time. -esc variants add one log-only line (escalation diagnostics).
cd "$(dirname "$0")"
G=81401,70492,32730,48684,57366,73023
echo "START lowA-music $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=600 node music-run-esc.mjs > m-low-a.log 2>&1
echo "START highA $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc.mjs > m-high-a.log 2>&1
echo "START lazyA $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=600 node balance-probe-m-esc.mjs > m-lazy-a.log 2>&1
echo "START gen-low $(date +%T)"; LINE=low SEEDS=$G SIMT=600 node route-play-rt-x-m-esc.mjs > g-low.log 2>&1
echo "START gen-lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=$G SIMT=600 node balance-probe-m-esc.mjs > g-lazy.log 2>&1
echo "START gen-high $(date +%T)"; LINE=high SEEDS=$G SIMT=600 node route-play-rt-x-m-esc.mjs > g-high.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "ALLDONE $(date +%T)"
