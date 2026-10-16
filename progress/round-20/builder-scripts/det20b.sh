#!/bin/zsh
# Round 20 builder: the deterministic batch, one process at a time at nice 19, so it can run beside the real-time queue
# without loading the machine (the critic saw Bronze street runs at load 12 to 17).
cd "$(dirname "$0")"; O=../builder/det; F=../builder/farms; N=../builder/nodeliv; mkdir -p $O $F $N
S12=(72692 72834 50400 50160 16541 74215 48251 72537 63888 26829 32548 38954)
jobs=()
for s in $S12; do
  jobs+=("SEEDS=$s FEAT=0 SIMT=600 node route-sign20.mjs > $O/sign-grid-$s.log 2>&1")
  jobs+=("SEEDS=$s FEAT=2 SIMT=600 SHOTS=1 node route-sign20.mjs > $O/sign-sign-$s.log 2>&1")
  jobs+=("SEEDS=$s FEAT=1 SIMT=600 node route-sign20.mjs > $O/sign-feat-$s.log 2>&1")
done
jobs+=("ALT=12 node crash-classify-v.mjs > $O/ccv12.log 2>&1" "ALT=20 node crash-classify-v.mjs > $O/ccv20.log 2>&1")
jobs+=("SEEDS=13926,28249,81891,71851,87946,13330,33593,49951,26478,30459,15851,45419,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018 node pad-audit18.mjs > $O/pad-audit20.log 2>&1")
for s in 22 58 130; do
  jobs+=("SEED=$s MODE=honest SIMT=600 node capfarm.mjs > $F/capfarm-honest-$s.log 2>&1")
  for M in tunnel alley van; do for T in 12 25; do jobs+=("SEED=$s MODE=$M FARMMAX=$T SIMT=600 node capfarm-narrow.mjs > $F/cfn-$M-$T-$s.log 2>&1"); done; done
  for M in tunnelidle alleyidle vanidle; do jobs+=("SEED=$s MODE=$M FARMMAX=12 SIMT=600 node capfarm-null20.mjs > $F/cfn-$M-12-$s.log 2>&1"); done
  jobs+=("SEED=$s MODE=carry SIMT=600 node capfarm.mjs > $F/capfarm-carry-$s.log 2>&1" "SEED=$s MODE=both SIMT=600 node capfarm.mjs > $F/capfarm-both-$s.log 2>&1")
  jobs+=("SEED=$s ROAD=66 OFF=6.5 SIMT=600 node farm-probe.mjs > $N/farm-$s-66.log 2>&1" "SEED=$s MODE=both FARMMAX=12 SIMT=600 node capfarm.mjs > $N/onedel-$s.log 2>&1")
done
jobs+=("SEED=22 SIMT=600 node farm-loop.mjs > $N/farmloop-22.log 2>&1" "SEED=22 MODE=near ROADX=66 SIMT=600 node smart-farm.mjs > $N/smart-near-22.log 2>&1" "SEED=130 MODE=pickupline ROADX=66 SIMT=600 node smart-farm.mjs > $N/smart-pickupline-130.log 2>&1")
i=0
for j in "${jobs[@]}"; do
  i=$((i+1)); f=${j##*> }; f=${f%% 2>&1}
  if [ -s "$f" ] && grep -qE '^(grid|sign|feat):|CAPFARM|PADAUDIT|score' "$f"; then continue; fi
  eval "${j/node /nice -n 19 node }"
  echo "$(date +%H:%M:%S) $i of ${#jobs[@]}"
done
wait
echo DETDONE $(date +%H:%M:%S)
