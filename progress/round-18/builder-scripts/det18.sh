#!/bin/zsh
# Round 18 builder: deterministic (advance-based) batch, run before any real-time script, never during one.
cd "$(dirname "$0")"
A1=89101,27874,55752,43564; A2=41272,12810,42547,41570; A3=99586,49549,64360,47096
echo "START det $(date +%T)"
ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1 &
ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1 &
CUT=1 LINE=low SEEDS=$A1 SIMT=600 node route-legs18-cut.mjs > cut1-a.log 2>&1 &
CUT=1 LINE=low SEEDS=$A2 SIMT=600 node route-legs18-cut.mjs > cut1-b.log 2>&1 &
CUT=1 LINE=low SEEDS=$A3 SIMT=600 node route-legs18-cut.mjs > cut1-c.log 2>&1 &
wait
echo "wave1 $(date +%T)"
CUT=0 LINE=low SEEDS=$A1 SIMT=600 node route-legs18-cut.mjs > cut0-a.log 2>&1 &
CUT=0 LINE=low SEEDS=$A2 SIMT=600 node route-legs18-cut.mjs > cut0-b.log 2>&1 &
CUT=0 LINE=low SEEDS=$A3 SIMT=600 node route-legs18-cut.mjs > cut0-c.log 2>&1 &
LINE=low SEEDS=$A1 SIMT=600 node route-legs17.mjs > legs-a.log 2>&1 &
LINE=low SEEDS=$A2 SIMT=600 node route-legs17.mjs > legs-b.log 2>&1 &
LINE=low SEEDS=$A3 SIMT=600 node route-legs17.mjs > legs-c.log 2>&1 &
wait
echo "wave2 $(date +%T)"
LINE=low SEEDS=22,58,130 SIMT=600 node route-legs17.mjs > gate-low.log 2>&1 &
LINE=high SEEDS=22,58,130 SIMT=600 node route-legs17.mjs > gate-high.log 2>&1 &
for m in carry both; do for s in 22 58 130; do SEED=$s MODE=$m FARMMAX=12 SIMT=600 node capfarm.mjs > otfarm-$m-12-$s.log 2>&1 & done; done
wait
echo "wave3 $(date +%T)"
./farms14.sh > farms14.log 2>&1 &
./capfarm.sh > capfarm.log 2>&1 &
wait
SEEDS=$(seq -s, 1001 1030) node pad-depots.mjs > padaudit30.log 2>&1
SEEDS=89101,27874,55752,43564,41272,12810,42547,41570,99586,49549,64360,47096 node cut-share.mjs > cutshare.log 2>&1
echo "DETDONE $(date +%T)"
