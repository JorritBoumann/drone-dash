#!/bin/zsh
# Round 46 builder: final pass on the final code, one browser at a time. The overtime session uses a 15 s start clock
# (round 45: 22 s) so the clock runs out while a parcel is aboard and overtime (the Breakbeat drop) is always reached.
cd "$(dirname "$0")"
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/b46
export OUTDIR=$SP/shots/; export OUT=$OUTDIR; mkdir -p $OUTDIR
node dev46b.mjs > $SP/dev.log 2>&1 &
DIST=$(cd ../../.. && pwd)/dist
node serve42.mjs 5193 $DIST / > $SP/s5193.log 2>&1 &
node serve42.mjs 5194 $DIST /nested/game/ > $SP/s5194.log 2>&1 &
node serve42.mjs 5195 . / outer > $SP/s5195.log 2>&1 &
sleep 3
echo "START $(date +%T)"
for T in classic breakbeat; do
  for M in main fx ot; do
    OT_START=15 TRACK=$T MODE=$M node rec46b.mjs > rec46-$T-$M.log 2>&1; echo "rec $T $M $(date +%T)"
  done
done
URL_=http://127.0.0.1:5199/ node acceptance-probe.mjs > flat46-classic.log 2>&1; echo "flat classic $(date +%T)"
URL_='http://127.0.0.1:5199/?music=breakbeat' node acceptance-probe.mjs > flat46-breakbeat.log 2>&1; echo "flat breakbeat $(date +%T)"
Q='?seed=22&slLaunch=x' node platform41c.mjs > platform46-classic.log 2>&1; echo "platform classic $(date +%T)"
Q='?seed=22&slLaunch=x&music=breakbeat' node platform41c.mjs > platform46-breakbeat.log 2>&1; echo "platform breakbeat $(date +%T)"
node platform41c-phone.mjs > platform46-phone.log 2>&1; echo "platform-phone $(date +%T)"
PORT=5193 Q="&music=breakbeat" node longtask45b.mjs > longtask46-d-breakbeat.log 2>&1; echo "lt-d $(date +%T)"
kill $(lsof -tiTCP:5193 -sTCP:LISTEN) $(lsof -tiTCP:5194 -sTCP:LISTEN) $(lsof -tiTCP:5195 -sTCP:LISTEN) 2>/dev/null
echo "ALLDONE $(date +%T)"
