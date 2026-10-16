#!/bin/zsh
# Round 20 critic: deterministic batch, strictly one browser at a time.
cd "$(dirname "$0")"
S=30397,67861,71635,73297,18304,20024,41556,38060,21060,15384,20323,55608
echo "START $(date +%T)"
for m in grid feat sign; do MODE=$m SEEDS=$S SIMT=600 SHOTS=1 node route-sign20.mjs > acc-$m.log 2>&1; echo "done $m $(date +%T)"; done
for s in 22 58 130; do
  for m in tunnel alley van; do SEED=$s MODE=$m FARMMAX=12 SIMT=600 node capfarm-narrow.mjs > cfn-$m-12-$s.log 2>&1; SEED=$s MODE=$m FARMMAX=25 SIMT=600 node capfarm-narrow.mjs > cfn-$m-25-$s.log 2>&1; done
  SEED=$s MODE=honest SIMT=600 node capfarm.mjs > capfarm-honest-$s.log 2>&1
  SEED=$s MODE=carry SIMT=600 node capfarm.mjs > capfarm-carry-$s.log 2>&1
done
echo "farms $(date +%T)"
for s in 22 58 130; do SEED=$s ROAD=66 OFF=6.5 SIMT=600 node farm-probe.mjs > farm-$s.log 2>&1; done
SEED=22 SIMT=600 node farm-loop.mjs > farmloop-22.log 2>&1
SEED=22 MODE=near SIMT=600 node smart-farm.mjs > smart-near-22.log 2>&1
SEED=58 MODE=spendpickup ROADX=66 SIMT=600 node smart-farm.mjs > smart-spend-58.log 2>&1
echo "ccv $(date +%T)"
ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1
ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1
echo "DET20 DONE $(date +%T)"
