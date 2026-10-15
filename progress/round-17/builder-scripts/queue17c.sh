#!/bin/zsh
# Round 17 builder: rest of the real-time queue (after the lazy run), one at a time, trimmed to the time box.
cd "$(dirname "$0")"
while pgrep -f "node balance-probe-m-esc.mjs" > /dev/null; do sleep 3; done
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START rep $(date +%T)"; LINE=low SEEDS=93049,29130 SIMT=600 node route-play-rt-x-m-esc.mjs > rep-low.log 2>&1
echo "ALLDONE $(date +%T)"
