#!/bin/zsh
# Round 47 builder: the three Breakbeat sessions again after softening the kit's attacks (2 to 2.5 ms), one browser.
cd "$(dirname "$0")"
echo "START $(date +%T)"
for M in main fx ot; do OT_START=15 OT_HOLD=3 TRACK=breakbeat MODE=$M node rec47.mjs > rec47-breakbeat-$M.log 2>&1; echo "rec breakbeat $M $(date +%T) $(tail -1 rec47-breakbeat-$M.log | cut -c1-120)"; done
echo "ALLDONE $(date +%T)"
