#!/bin/zsh
# Round 18 critic: deterministic regressions and farms, after det18 (grid vs shortcut bots), 2 at a time, nice 19.
cd "$(dirname "$0")"
while ! grep -q DETDONE feat-feat.log 2>/dev/null; do sleep 5; done
echo "START ccv $(date +%T)"
ALT=12 nice -n 19 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 nice -n 19 node crash-classify-v.mjs > ccv20.log 2>&1 &
wait
echo "START otfarm $(date +%T)"
for s in 22 58 130; do
  SEED=$s MODE=both FARMMAX=12 SIMT=600 nice -n 19 node capfarm.mjs > otfarm-both-12-$s.log 2>&1 &
  SEED=$s MODE=both FARMMAX=20 SIMT=600 nice -n 19 node capfarm.mjs > otfarm-both-20-$s.log 2>&1 &
  wait
done
echo "START capfarm $(date +%T)"
cf() { SEED=$2 MODE=$1 SIMT=600 nice -n 19 node capfarm.mjs > capfarm-$1-$2.log 2>&1; }
cf honest 22 & cf carry 22 & wait
cf honest 58 & cf carry 58 & wait
cf honest 130 & cf carry 130 & wait
cf both 22 & cf both 130 & wait
echo "START farms $(date +%T)"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 nice -n 19 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1; }
sm() { SEED=$2 MODE=$1 ROADX=${3:-66} SIMT=600 nice -n 19 node smart-farm.mjs > smart-$1-$2${3:+-$3}.log 2>&1; }
run 22 66 6.5 & run 58 66 6.5 & wait
run 130 66 6.5 & SEED=22 SIMT=600 nice -n 19 node farm-loop.mjs > farmloop-22.log 2>&1 & wait
sm near 22 & sm near 130 & wait
sm pickupline 22 66 & sm pickupline 130 66 & wait
sm spendpickup 22 66 & sm spendpickup 58 66 & wait
echo "DET18B DONE $(date +%T)"
