#!/bin/zsh
# Round 19 builder: deterministic batch (advance-based), all before the real-time queue, never during it.
cd "$(dirname "$0")"
S=(77984,51714 55642,15336 80212,55130 41128,23571 72971,37812 15756,63138)
for i in {1..6}; do
  SEEDS=${S[$i]} FEAT=0 SIMT=600 nice -n 5 node route-feat18.mjs > feat-grid-$i.log 2>&1 &
  SEEDS=${S[$i]} FEAT=1 SIMT=600 SHOTS=1 nice -n 5 node route-feat18.mjs > feat-feat-$i.log 2>&1 &
done
SEEDS=77984,51714,55642,15336,80212,55130,41128,23571,72971,37812,15756,63138 LEGS=12 nice -n 5 node hint-probe19.mjs > hint-d.log 2>&1 &
SEEDS=77984,51714,55642,15336,80212,55130,41128,23571,72971,37812,15756,63138,57267,96431,24640,47005,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014 nice -n 5 node pad-audit18.mjs > pad-audit19.log 2>&1 &
wait
echo "START det2 $(date +%T)"
SEEDS=77984,51714,55642,15336 LEGS=6 MOBILE=1 nice -n 5 node hint-probe19.mjs > hint-m.log 2>&1 &
ALT=12 nice -n 5 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 nice -n 5 node crash-classify-v.mjs > ccv20.log 2>&1 &
LINE=low SEEDS=22,58,130 SIMT=600 nice -n 5 node route-legs17.mjs > gate-low-det.log 2>&1 &
LINE=high SEEDS=22,58,130 SIMT=600 nice -n 5 node route-legs17.mjs > gate-high-det.log 2>&1 &
for s in 22 58 130; do SEED=$s MODE=honest SIMT=600 nice -n 5 node capfarm.mjs > capfarm-honest-$s.log 2>&1 & SEED=$s MODE=carry SIMT=600 nice -n 5 node capfarm.mjs > capfarm-carry-$s.log 2>&1 & done
wait
echo "START det3 $(date +%T)"
for s in 22 58 130; do SEED=$s MODE=both FARMMAX=12 SIMT=600 nice -n 5 node capfarm.mjs > otfarm-both-12-$s.log 2>&1 & SEED=$s ROAD=66 OFF=6.5 SIMT=600 nice -n 5 node farm-probe.mjs > farm-$s-66-6.5.log 2>&1 & done
SEED=22 SIMT=600 nice -n 5 node farm-loop.mjs > farmloop-22.log 2>&1 &
SEED=22 MODE=near SIMT=600 nice -n 5 node smart-farm.mjs > smart-near-22.log 2>&1 &
SEED=130 MODE=pickupline ROADX=66 SIMT=600 nice -n 5 node smart-farm.mjs > smart-pickupline-130-66.log 2>&1 &
SEED=22 nice -n 5 node van-probe19.mjs > van-22.log 2>&1 &
SEED=58 nice -n 5 node van-probe19.mjs > van-58.log 2>&1 &
wait
echo "DET19 DONE $(date +%T)"
