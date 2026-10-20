#!/bin/zsh
# Round 47 builder: regression checks on the final code, one browser at a time. Dev server 5199 (started separately),
# (Breakbeat is the default now: the Breakbeat probes use no ?music flag, the Classic ones ?music=classic.)
# static servers 5193 (dist at /), 5194 (dist under /nested/game/), 5195 (outer page for the cross-origin iframe).
cd "$(dirname "$0")"
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b47
export OUTDIR=$SP/shots/; export OUT=$OUTDIR; mkdir -p $OUTDIR
DIST=$(cd ../../.. && pwd)/dist
node serve42.mjs 5193 $DIST / > $SP/s5193.log 2>&1 &
node serve42.mjs 5194 $DIST /nested/game/ > $SP/s5194.log 2>&1 &
node serve42.mjs 5195 . / outer > $SP/s5195.log 2>&1 &
sleep 2
echo "START $(date +%T)"
node drums47.mjs > drums47.log 2>&1; echo "drums $(date +%T)"
node default47.mjs > default47.log 2>&1; echo "default $(date +%T)"
URL_='http://127.0.0.1:5199/?music=classic' node acceptance-probe.mjs > flat47-classic.log 2>&1; echo "flat classic $(date +%T)"
URL_='http://127.0.0.1:5199/' node acceptance-probe.mjs > flat47-breakbeat.log 2>&1; echo "flat breakbeat $(date +%T)"
for T in classic breakbeat; do
  UNCAP=1 Q="&music=$T" node perf-street41.mjs > perf47-d-$T.log 2>&1; echo "perf-d $T $(date +%T)"
  UNCAP=1 MOBILE=1 Q="&music=$T" node perf-street41.mjs > perf47-m-$T.log 2>&1; echo "perf-m $T $(date +%T)"
done
for T in classic breakbeat; do PORT=5193 Q="&music=$T" node longtask45b.mjs > longtask47-d-$T.log 2>&1; echo "lt-d $T $(date +%T)"; done
Q='?seed=22&slLaunch=x&music=classic' node platform41c.mjs > platform47-classic.log 2>&1; echo "platform classic $(date +%T)"
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform47-breakbeat.log 2>&1; echo "platform breakbeat $(date +%T)"
node platform41c-phone.mjs > platform47-phone.log 2>&1; echo "platform-phone $(date +%T)"
node nodes47.mjs > nodes47.log 2>&1; echo "nodes $(date +%T)"
kill $(lsof -tiTCP:5193 -sTCP:LISTEN) $(lsof -tiTCP:5194 -sTCP:LISTEN) $(lsof -tiTCP:5195 -sTCP:LISTEN) 2>/dev/null
echo "ALLDONE $(date +%T)"
