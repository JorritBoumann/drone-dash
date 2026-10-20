#!/bin/zsh
# Round 47 builder: the six recording sessions on the final code, one browser at a time (own dev server on 5199).
# Same sessions as round 46 (rec46b.mjs -> rec47.mjs); the overtime session keeps the 15 s start clock and adds OT_HOLD=3
# (the pilot hovers 3 s when overtime starts, so the gap and the drop are on the recording).
cd "$(dirname "$0")"
echo "START $(date +%T)"
for T in breakbeat classic; do
  for M in main fx ot; do
    OT_START=15 OT_HOLD=3 TRACK=$T MODE=$M node rec47.mjs > rec47-$T-$M.log 2>&1; echo "rec $T $M $(date +%T) $(tail -1 rec47-$T-$M.log | cut -c1-160)"
  done
done
echo "ALLDONE $(date +%T)"
