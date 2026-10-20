#!/bin/zsh
# Round 45 builder: final pass on the last build (one browser at a time).
cd "$(dirname "$0")"
export OUTDIR=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b45/shots/; export OUT=$OUTDIR
echo "START $(date +%T)"
node toggle45b.mjs > toggle45b.log 2>&1; echo "toggle $(date +%T)"
URL_=http://127.0.0.1:5197/ node acceptance-probe.mjs > flat45b.log 2>&1; echo "flat $(date +%T)"
UNCAP=1 node perf-street41.mjs > perf45b-d.log 2>&1; echo "perf-d $(date +%T)"
UNCAP=1 MOBILE=1 node perf-street41.mjs > perf45b-m.log 2>&1; echo "perf-m $(date +%T)"
UNCAP=1 MOBILE=1 Q="&hud=canvas" node perf-street41.mjs > perf45b-m-chud.log 2>&1; echo "perf-m-chud $(date +%T)"
PORT=5193 node longtask45b.mjs > longtask45b-d.log 2>&1; echo "lt-d $(date +%T)"
PORT=5193 MOBILE=1 node longtask45b.mjs > longtask45b-m.log 2>&1; echo "lt-m $(date +%T)"
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform45b.log 2>&1; echo "platform $(date +%T)"
node platform41c-phone.mjs > platform45b-phone.log 2>&1; echo "platform-phone $(date +%T)"
PORT=5193 ONLY=se-568,iphone-safe,desk node over44.mjs > over45b.log 2>&1; echo "over $(date +%T)"
echo "ALLDONE $(date +%T)"
