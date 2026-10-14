#!/bin/zsh
cd "$(dirname "$0")"
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "START mj-mobile $(date +%T)"; MOBILE=1 node medal-journey.mjs > mj-mobile.log 2>&1
echo "START am7 $(date +%T)"; SEEDS=7 node arrival-metrics.mjs > am-seed7-rerun.log 2>&1
echo "ALLDONE3 $(date +%T)"
