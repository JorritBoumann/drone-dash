#!/bin/zsh
# Round 17 critic: same-city repeats of the street bot in real time (one at a time) on the two lowest and two highest acceptance cities.
cd "$(dirname "$0")"
while ! grep -q ALLDONE queue17.log; do sleep 5; done
echo "START rep $(date +%T)"; LINE=low SEEDS=52809,55211,65191,16805,52809,55211,65191,16805 SIMT=600 node route-play-rt-x-m-esc17.mjs > rep-low.log 2>&1
echo "REPDONE $(date +%T)"
