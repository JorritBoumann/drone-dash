#!/bin/zsh
# Round 16 critic: deterministic (advance-based) checks, run before the real-time queue, never during it.
cd "$(dirname "$0")"
A=80258,40443,66012,97343,73243,12668,96842,54408,19093,84143,62367,36020
echo "START det $(date +%T)"
N=24 node city-audit16.mjs > city-audit.log 2>&1 &
ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1 &
LINE=low SEEDS=$A LEGS=10 SIMT=900 node reach16.mjs > reach16-low.log 2>&1 &
wait
echo "audit+cc+reach done $(date +%T)"
./farms14.sh > farms14.log 2>&1
echo "farms done $(date +%T)"
./capfarm.sh > capfarm.log 2>&1
echo "DETDONE $(date +%T)"
