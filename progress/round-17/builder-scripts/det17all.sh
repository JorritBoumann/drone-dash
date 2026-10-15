#!/bin/zsh
# Round 17 builder: deterministic batch (advance-based), before the real-time queue.
cd "$(dirname "$0")"
echo "START det $(date +%T)"
F=32124,14545,97836,48947,96635,97214,79278,59437,29130,30593,32429,93049
LEGSHOT=1 SEEDS=$F OUTP=fin PAR=6 ./det17.sh > /dev/null 2>&1 &
LINE=low SEEDS=22,58,130 OUTP=gl PAR=3 ./det17.sh > /dev/null 2>&1 &
LINE=high SEEDS=22,58,130 OUTP=gh PAR=3 ./det17.sh > /dev/null 2>&1 &
./capfarm.sh > capfarm.log 2>&1 &
wait
echo "legs+gates+capfarm done $(date +%T)"
./farms14.sh > farms14.log 2>&1
echo "DETDONE $(date +%T)"
