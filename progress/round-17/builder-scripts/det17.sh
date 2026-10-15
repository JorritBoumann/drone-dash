#!/bin/zsh
# Round 17 builder: deterministic street runs (route-legs17) on a seed list, 4 processes at a time.
cd "$(dirname "$0")"
OUTP=${OUTP:-det}
i=0
for s in ${(s:,:)SEEDS}; do
  LINE=${LINE:-low} SEEDS=$s SIMT=600 LEGSHOT=${LEGSHOT:-} node route-legs17.mjs > $OUTP-$s.log 2>&1 &
  i=$((i+1)); if (( i % ${PAR:-4} == 0 )); then wait; fi
done
wait
echo DONE
