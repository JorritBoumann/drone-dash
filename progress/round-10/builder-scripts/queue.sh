#!/bin/zsh
# Round 10 builder: timing-sensitive scripts one at a time (after the low-line music run).
cd "$(dirname "$0")"
until grep -q '^done' low-music.log 2>/dev/null; do sleep 3; done
echo "START lazy $(date +%T)"; LINE=low OFF=0 CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=400 node balance-probe-m.mjs > m-lazy.log 2>&1
echo "START high $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=400 node route-play-music.mjs > m-high.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START screens-m $(date +%T)"; MOBILE=1 node music-screens.mjs > screens-mobile.log 2>&1
echo "START screens-d $(date +%T)"; node music-screens.mjs > screens-desktop.log 2>&1
echo "START cc12 $(date +%T)"; ALT=12 node crash-classify.mjs > cc12.log 2>&1
echo "START cc20 $(date +%T)"; ALT=20 node crash-classify.mjs > cc20.log 2>&1
echo "START ccv12 $(date +%T)"; ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1
echo "START ccv20 $(date +%T)"; ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1
echo "ALLDONE $(date +%T)"
