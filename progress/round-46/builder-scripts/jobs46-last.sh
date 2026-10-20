#!/bin/zsh
# Round 46 builder: last pass after the Breakbeat pass-by lift: the three Breakbeat sessions again, the effects-switch
# check, and the release smoke test on the final production build. One browser at a time.
cd "$(dirname "$0")"
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46
export OUTDIR=$SP/shots/; export OUT=$OUTDIR
node dev46b.mjs > $SP/dev.log 2>&1 &
DIST=$(cd ../../.. && pwd)/dist
node serve42.mjs 5194 $DIST /nested/game/ > $SP/s5194.log 2>&1 &
node serve42.mjs 5195 . / outer > $SP/s5195.log 2>&1 &
sleep 3
echo "START $(date +%T)"
for M in main fx ot; do OT_START=15 TRACK=breakbeat MODE=$M node rec46b.mjs > rec46-breakbeat-$M.log 2>&1; echo "rec breakbeat $M $(date +%T)"; done
node sfxoff46.mjs > sfxoff46.log 2>&1; echo "sfxoff $(date +%T)"
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform46-classic.log 2>&1; echo "platform classic $(date +%T)"
Q='?seed=22&slLaunch=x&music=breakbeat' node platform41c.mjs > platform46-breakbeat.log 2>&1; echo "platform breakbeat $(date +%T)"
kill $(lsof -tiTCP:5194 -sTCP:LISTEN) $(lsof -tiTCP:5195 -sTCP:LISTEN) $(lsof -tiTCP:5199 -sTCP:LISTEN) 2>/dev/null
echo "ALLDONE $(date +%T)"
