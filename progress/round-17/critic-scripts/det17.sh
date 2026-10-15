#!/bin/zsh
# Round 17 critic: deterministic (advance-based) checks, run before the real-time queue, never during it.
cd "$(dirname "$0")"
echo "START det $(date +%T)"
ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1 &
LEGSHOT=1 LINE=low SEEDS=55211,52809,95387,16805 SIMT=600 node route-legs17.mjs > legs-a.log 2>&1 &
LEGSHOT=1 LINE=low SEEDS=14523,15493,88700,68665 SIMT=600 node route-legs17.mjs > legs-b.log 2>&1 &
LEGSHOT=1 LINE=low SEEDS=65188,25215,83341,61719 SIMT=600 node route-legs17.mjs > legs-c.log 2>&1 &
wait
echo "cc+legs done $(date +%T)"
./farms14.sh > farms14.log 2>&1
echo "farms done $(date +%T)"
./capfarm.sh > capfarm.log 2>&1
echo "DETDONE $(date +%T)"
