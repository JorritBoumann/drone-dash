#!/bin/zsh
# re-check runs, strictly one at a time
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-48/recheck
P=pilot48-recheck.mjs
run() { echo "== $1" >&2; node $P "$@" 2>>runs.err | tee -a runs.log; }
run s130-eager '?seed=130' eagerhold shots
run daily-eager '?daily' eagerhold
run s130-casual '?seed=130' casual
run daily-casual '?daily' casual shots
run s130-careful '?seed=130' careful
run daily-careful '?daily' careful
run phone-s130-casual '?seed=130' casual phone shots
run phone-daily-eager '?daily' eagerhold phone
run s130-slow-loss '?seed=130' slow
echo DONE >> runs.log
