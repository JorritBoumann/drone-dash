#!/bin/zsh
# Round 16 critic: same-city repeats of the street bot in real time (one at a time), to measure run-to-run noise on outliers.
cd "$(dirname "$0")"
echo "START rep $(date +%T)"; LINE=low SEEDS=62367,36020,54408,62367 SIMT=600 node route-play-rt-x-m-esc.mjs > rep-low.log 2>&1
echo "REPDONE $(date +%T)"
