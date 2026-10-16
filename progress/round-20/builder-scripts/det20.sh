#!/bin/zsh
# Round 20 builder: deterministic batch (nothing real time runs beside it). 12 fresh cities, one process per city and bot:
# grid bot (FEAT=0), sign follower (FEAT=2), shortcut bot (FEAT=1, the critic's control). Then crash-classify at 12 and
# 20 m on the 8 regression seeds, and the pad audit on 30 seeds.
cd "$(dirname "$0")"; O=../builder/det; mkdir -p $O
S12=(72692 72834 50400 50160 16541 74215 48251 72537 63888 26829 32548 38954)
for M in 0 2 1; do
  for s in $S12; do
    T=$([ $M = 0 ] && echo grid || ([ $M = 2 ] && echo sign || echo feat))
    SEEDS=$s FEAT=$M SIMT=600 SHOTS=$([ $M = 2 ] && echo 1) nice -n 10 node route-sign20.mjs > $O/sign-$T-$s.log 2>&1 &
  done
  wait
done
ALT=12 nice -n 10 node crash-classify-v.mjs > $O/ccv12.log 2>&1 &
ALT=20 nice -n 10 node crash-classify-v.mjs > $O/ccv20.log 2>&1 &
SEEDS=13926,28249,81891,71851,87946,13330,33593,49951,26478,30459,15851,45419,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018 nice -n 10 node pad-audit18.mjs > $O/pad-audit20.log 2>&1 &
wait
echo DETDONE
