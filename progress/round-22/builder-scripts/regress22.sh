#!/bin/zsh
# Round 22 builder: regression queue (copy of regress21.sh), strictly one browser at a time (round 20 critic scripts, port 5190).
cd "$(dirname "$0")"
echo "START $(date +%T)"
node hand-fly20.mjs > hf-desktop.log 2>&1; echo "hf-d $(date +%T)"
MOBILE=1 node hand-fly20.mjs > hf-mobile.log 2>&1; echo "hf-m $(date +%T)"
node acceptance-probe.mjs > flat.log 2>&1; echo "flat $(date +%T)"
node perf18.mjs > perf-desktop.log 2>&1
MOBILE=1 node perf18.mjs > perf-mobile.log 2>&1; echo "perf $(date +%T)"
ALT=12 SEEDS=22,58,130 node crash-classify-v.mjs > ccv12.log 2>&1; echo "ccv $(date +%T)"
LINE=low SEEDS=22,58,130 SIMT=600 node music-run-esc.mjs > m-low-a.log 2>&1; echo "low $(date +%T)"
LINE=high SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc17.mjs > m-high-a.log 2>&1; echo "high $(date +%T)"
echo "DONE $(date +%T)"
