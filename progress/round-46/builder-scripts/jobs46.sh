#!/bin/zsh
# Round 46 builder: every browser job, one at a time. Servers: 5199 dev (mine), 5193 dist at the root, 5194 dist under
# /nested/game/, 5195 the cross-origin outer page. The owner's 5188 is never touched.
cd "$(dirname "$0")"
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46
export OUTDIR=$SP/shots/; export OUT=$OUTDIR; mkdir -p $OUTDIR
DIST=$(cd ../../.. && pwd)/dist
node serve42.mjs 5193 $DIST / > $SP/s5193.log 2>&1 &
node serve42.mjs 5194 $DIST /nested/game/ > $SP/s5194.log 2>&1 &
node serve42.mjs 5195 . / outer > $SP/s5195.log 2>&1 &
sleep 1
echo "START $(date +%T)"
for T in classic breakbeat; do
  for M in main fx ot; do
    TRACK=$T MODE=$M node rec46b.mjs > rec46-$T-$M.log 2>&1; echo "rec $T $M $(date +%T)"
  done
done
node nodes46.mjs > nodes46.log 2>&1; echo "nodes $(date +%T)"
URL_=http://127.0.0.1:5199/ node acceptance-probe.mjs > flat46-classic.log 2>&1; echo "flat classic $(date +%T)"
URL_='http://127.0.0.1:5199/?music=breakbeat' node acceptance-probe.mjs > flat46-breakbeat.log 2>&1; echo "flat breakbeat $(date +%T)"
for T in classic breakbeat; do
  UNCAP=1 Q="&music=$T" node perf-street41.mjs > perf46-d-$T.log 2>&1; echo "perf-d $T $(date +%T)"
  UNCAP=1 MOBILE=1 Q="&music=$T" node perf-street41.mjs > perf46-m-$T.log 2>&1; echo "perf-m $T $(date +%T)"
  PORT=5193 Q="&music=$T" node longtask45b.mjs > longtask46-d-$T.log 2>&1; echo "lt-d $T $(date +%T)"
  PORT=5193 MOBILE=1 Q="&music=$T" node longtask45b.mjs > longtask46-m-$T.log 2>&1; echo "lt-m $T $(date +%T)"
done
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform46-classic.log 2>&1; echo "platform classic $(date +%T)"
Q='?seed=22&slLaunch=x&music=breakbeat' node platform41c.mjs > platform46-breakbeat.log 2>&1; echo "platform breakbeat $(date +%T)"
node platform41c-phone.mjs > platform46-phone.log 2>&1; echo "platform-phone $(date +%T)"
node ui46.mjs > ui46.log 2>&1; echo "ui $(date +%T)"
node fit46.mjs > fit46.log 2>&1; echo "fit $(date +%T)"
kill $(lsof -tiTCP:5193 -sTCP:LISTEN) $(lsof -tiTCP:5194 -sTCP:LISTEN) $(lsof -tiTCP:5195 -sTCP:LISTEN) 2>/dev/null
echo "ALLDONE $(date +%T)"
