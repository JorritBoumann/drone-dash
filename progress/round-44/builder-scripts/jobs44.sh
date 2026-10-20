#!/bin/zsh
# Round 44 builder: every browser job one at a time.
cd "$(dirname "$0")"
export OUTDIR=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b44/shots/; export OUT=$OUTDIR
echo "START $(date +%T)"
DEV=iphone SAFE=1 SEED=22 Q="" node play44.mjs >> play44.log 2>&1; echo "done1 $(date +%T)"
DEV=iphone SAFE=1 SEED=22 Q="&hud=canvas" node play44.mjs >> play44.log 2>&1; echo "done2 $(date +%T)"
DEV=p915 SEED=130 Q="" node play44.mjs >> play44.log 2>&1; echo "done3 $(date +%T)"
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform44.log 2>&1; echo "done4 $(date +%T)"
node platform41c-phone.mjs > platform44-phone.log 2>&1; echo "done5 $(date +%T)"
node acceptance-probe.mjs > flat44.log 2>&1; echo "done6 $(date +%T)"
UNCAP=1 node perf-street41.mjs > perf-street44-d.log 2>&1; echo "done7 $(date +%T)"
UNCAP=1 MOBILE=1 node perf-street41.mjs > perf-street44-m.log 2>&1; echo "done8 $(date +%T)"
UNCAP=1 MOBILE=1 Q="&hud=canvas" node perf-street41.mjs > perf-street44-m-chud.log 2>&1; echo "done9 $(date +%T)"
echo "ALLDONE $(date +%T)"
