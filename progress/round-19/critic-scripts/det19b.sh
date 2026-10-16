#!/bin/zsh
# Round 19 critic: deterministic farms, regressions and audits, 2 at a time, nice 19 (beside det19 and the real-time queue).
cd "$(dirname "$0")"

echo "START cfn $(date +%T)"
for s in 22 58 130; do
  for m in tunnel alley van; do
    SEED=$s MODE=$m FARMMAX=12 SIMT=600 nice -n 19 node capfarm-narrow.mjs > cfn-$m-12-$s.log 2>&1 &
    SEED=$s MODE=$m FARMMAX=25 SIMT=600 nice -n 19 node capfarm-narrow.mjs > cfn-$m-25-$s.log 2>&1 &
    wait
  done
  SEED=$s MODE=honest SIMT=600 nice -n 19 node capfarm.mjs > capfarm-honest-$s.log 2>&1 &
  SEED=$s MODE=carry SIMT=600 nice -n 19 node capfarm.mjs > capfarm-carry-$s.log 2>&1 &
  wait
done
SEED=22 MODE=both SIMT=600 nice -n 19 node capfarm.mjs > capfarm-both-22.log 2>&1 &
SEED=130 MODE=both SIMT=600 nice -n 19 node capfarm.mjs > capfarm-both-130.log 2>&1 &
wait
echo "START audits $(date +%T)"
SEEDS=19860,85749,96382,14820,29724,70006,84383,23893,61564,39178,94202,49588,72214,65264,34173,50169,36880,98757,46825,65279 nice -n 19 node pad-audit18.mjs > pad-audit19.log 2>&1 &
SEEDS=16068,20540,22132,34471,32134,34372,99113,20188,47664,20823,26635,96680 SPD=20 nice -n 19 node alley-fly18.mjs > alleyfly-20.log 2>&1 &
wait
echo "START ccv $(date +%T)"
ALT=12 nice -n 19 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 nice -n 19 node crash-classify-v.mjs > ccv20.log 2>&1 &
wait
echo "START farms $(date +%T)"
run() { SEED=$1 ROAD=$2 OFF=$3 SIMT=600 nice -n 19 node farm-probe.mjs > farm-$1-$2-$3.log 2>&1; }
sm() { SEED=$2 MODE=$1 ROADX=${3:-66} SIMT=600 nice -n 19 node smart-farm.mjs > smart-$1-$2${3:+-$3}.log 2>&1; }
run 22 66 6.5 & run 58 66 6.5 & wait
run 130 66 6.5 & SEED=22 SIMT=600 nice -n 19 node farm-loop.mjs > farmloop-22.log 2>&1 & wait
sm near 22 & sm near 130 & wait
sm pickupline 22 66 & sm spendpickup 58 66 & wait
echo "DET19B DONE $(date +%T)"
