#!/bin/zsh
# Round 20 builder: final-code deterministic batch on a dev server at port 5189 (the real-time queue uses the frozen
# production build on 5188). One process at a time, nice 19. Same scripts with only the port changed (p5189-*.mjs).
cd "$(dirname "$0")"; O=../builder/detF; F=../builder/farmsF; mkdir -p $O $F
S12=(72692 72834 50400 50160 16541 74215 48251 72537 63888 26829 32548 38954)
r() { eval "$1"; echo "$(date +%H:%M:%S) $2"; }
for s in $S12; do r "SEEDS=$s FEAT=1 SIMT=600 nice -n 19 node p5189-route-sign20.mjs > $O/sign-feat-$s.log 2>&1" feat-$s; done
for s in $S12; do r "SEEDS=$s FEAT=0 SIMT=600 nice -n 19 node p5189-route-sign20.mjs > $O/sign-grid-$s.log 2>&1" grid-$s; r "SEEDS=$s FEAT=2 SIMT=600 SHOTS=1 nice -n 19 node p5189-route-sign20.mjs > $O/sign-sign-$s.log 2>&1" sign-$s; done
r "ALT=12 nice -n 19 node p5189-crash-classify-v.mjs > $O/ccv12.log 2>&1" ccv12
r "ALT=20 nice -n 19 node p5189-crash-classify-v.mjs > $O/ccv20.log 2>&1" ccv20
r "SEEDS=13926,28249,81891,71851,87946,13330,33593,49951,26478,30459,15851,45419,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018 nice -n 19 node p5189-pad-audit18.mjs > $O/pad-audit20.log 2>&1" pad
for s in 22 58 130; do
  r "SEED=$s MODE=honest SIMT=600 nice -n 19 node p5189-capfarm.mjs > $F/capfarm-honest-$s.log 2>&1" honest-$s
  for M in tunnel alley van; do r "SEED=$s MODE=$M FARMMAX=12 SIMT=600 nice -n 19 node p5189-capfarm-narrow.mjs > $F/cfn-$M-12-$s.log 2>&1" $M-$s; done
  for M in tunnelidle alleyidle vanidle; do r "SEED=$s MODE=$M FARMMAX=12 SIMT=600 nice -n 19 node p5189-capfarm-null20.mjs > $F/cfn-$M-12-$s.log 2>&1" $M-$s; done
  r "SEED=$s MODE=both FARMMAX=12 SIMT=600 nice -n 19 node p5189-capfarm.mjs > $F/onedel-$s.log 2>&1" one-$s
done
echo DETDONE
