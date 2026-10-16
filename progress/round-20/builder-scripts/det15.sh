#!/bin/zsh
# Round 15 critic: deterministic (advance-based) checks, run before the real-time queue, never during it.
cd "$(dirname "$0")"
echo "START det $(date +%T)"
N=24 node city-audit.mjs > city-audit.log 2>&1 &
ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1 &
wait
echo "audit+cc done $(date +%T)"
./farms14.sh > farms14.log 2>&1
echo "farms done $(date +%T)"
./capfarm.sh > capfarm.log 2>&1
echo "DETDONE $(date +%T)"
