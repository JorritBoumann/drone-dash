#!/bin/zsh
cd "$(dirname "$0")"
SEEDS=16068,20540,22132,34471,32134,34372 FEAT=0 SIMT=600 nice -n 19 node route-feat19.mjs > feat-grid-a.log 2>&1 &
SEEDS=16068,20540,22132,34471,32134,34372 FEAT=1 SIMT=600 SHOTS=1 nice -n 19 node route-feat19.mjs > feat-feat-a.log 2>&1 &
wait
SEEDS=99113,20188,47664,20823,26635,96680 FEAT=0 SIMT=600 nice -n 19 node route-feat19.mjs > feat-grid-b.log 2>&1 &
SEEDS=99113,20188,47664,20823,26635,96680 FEAT=1 SIMT=600 SHOTS=1 nice -n 19 node route-feat19.mjs > feat-feat-b.log 2>&1 &
wait
echo DETDONE > det19.done
