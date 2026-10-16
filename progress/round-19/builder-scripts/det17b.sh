#!/bin/zsh
# Round 17 critic: spread controls (deterministic). Same 12 cities with the beeline (high) bot and with a quicker-cornering street bot (CORNER=11).
cd "$(dirname "$0")"
LINE=high SEEDS=55211,52809,95387,16805,14523,15493 SIMT=600 node route-legs17.mjs > legs-high-a.log 2>&1 &
LINE=high SEEDS=88700,68665,65188,25215,83341,61719 SIMT=600 node route-legs17.mjs > legs-high-b.log 2>&1 &
CORNER=11 LINE=low SEEDS=55211,52809,95387,16805,14523,15493 SIMT=600 node route-legs17.mjs > legs-c11-a.log 2>&1 &
CORNER=11 LINE=low SEEDS=88700,68665,65188,25215,83341,61719 SIMT=600 node route-legs17.mjs > legs-c11-b.log 2>&1 &
wait
echo "DET17B DONE $(date +%T)"
