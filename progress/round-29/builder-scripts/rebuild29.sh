#!/bin/zsh
# Round 29 builder: production snapshot served by vite preview on 5191 (new build). BASE=1 builds the baseline (round 28 code) to 5192.
S=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash
if [ -n "$BASE" ]; then D=snap28; P=5192; else D=snap29; P=5191; fi
pkill -f "vite preview --outDir $S/$D --host 127.0.0.1 --port $P" ; sleep 1
npx vite build --outDir $S/$D --emptyOutDir > $S/build-$D.log 2>&1 || { echo BUILD FAILED; tail -20 $S/build-$D.log; }
(nohup npx vite preview --outDir $S/$D --host 127.0.0.1 --port $P --strictPort > $S/preview-$D.log 2>&1 &)
for i in 1 2 3 4 5 6 7 8 9 10; do sleep 1; curl -s -o /dev/null http://127.0.0.1:$P/ && break; done
echo "rebuilt $D on $P $(date +%T)"
