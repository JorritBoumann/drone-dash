#!/bin/zsh
# Round 17 critic: overtime and time-up share exploit probes. capfarm carry/both with short farm phases (FARMMAX 12 and 20 s),
# so the leg stays inside the schedule window that overtime and the time-up share require. Deterministic, one at a time, nice 19.
cd "$(dirname "$0")"
for fm in 12 20; do for m in carry both; do for s in 22 58 130; do
  SEED=$s MODE=$m FARMMAX=$fm SIMT=600 nice -n 19 node capfarm.mjs > otfarm-$m-$fm-$s.log 2>&1
done; done; done
echo OTFARMDONE
