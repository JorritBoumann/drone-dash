#!/bin/zsh
cd "$(dirname "$0")"
SEEDS=44840,66352,86749,69865,66633,54075,81658,53713,39728,82412,43361,40118 FEAT=0 SIMT=600 nice -n 19 node route-feat18.mjs > feat-grid.log 2>&1 &
SEEDS=44840,66352,86749,69865,66633,54075,81658,53713,39728,82412,43361,40118 FEAT=1 SIMT=600 SHOTS=1 nice -n 19 node route-feat18.mjs > feat-feat.log 2>&1 &
wait
echo DETDONE >> feat-feat.log
