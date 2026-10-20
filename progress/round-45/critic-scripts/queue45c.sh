#!/bin/zsh
# Round 45 critic: every browser job one at a time. Own servers: dev 5197, dist nested 5194, outer 5195. Never 5188.
cd "$(dirname "$0")"
G=/Users/jorritboumann/projects/browser-game-lab/games/drone-dash
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c45
echo "gate $(date +%T)"; PORT=5197 node gate45c.mjs > gate45c.log 2>&1
echo "build $(date +%T)"; (cd $G && npm run build) > build45c.log 2>&1
node serve42.mjs 5194 $G/dist /nested/game/ > $SP/s5194.log 2>&1 & S1=$!
node serve42.mjs 5195 $G/dist / outer > $SP/s5195.log 2>&1 & S2=$!
sleep 1.5
echo "platform $(date +%T)"; OUTDIR=$SP/ Q='?seed=22&slLaunch=x' node platform41c.mjs > platform45c.log 2>&1
kill $S1 $S2
echo "flat $(date +%T)"; URL_=http://127.0.0.1:5197/ node acceptance-probe.mjs > flat45c.log 2>&1
echo "perf $(date +%T)"; UNCAP=1 MOBILE=1 node perf45c.mjs > perf45c-m.log 2>&1
UNCAP=1 MOBILE=1 Q="&hud=canvas" node perf45c.mjs > perf45c-m-chud.log 2>&1
UNCAP=1 node perf45c.mjs > perf45c-d.log 2>&1
CPU=4 UNCAP=1 MOBILE=1 node perf45c.mjs > perf45c-m-cpu4.log 2>&1
echo "over $(date +%T)"; MODE=main PORT=5197 TITLE_S=1 OVER_S=4 DEVICE='iPhone SE landscape' OVERCHECK=1 SHOT=$G/progress/round-45/critic-audio/iphone-se-over-card RAW=$SP/rawse/ node rec45c.mjs > over45c.log 2>&1
echo "ALLDONE $(date +%T)"
