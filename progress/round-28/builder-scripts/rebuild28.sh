#!/bin/zsh
# Round 28 builder: rebuild the snapshot the bots play (a production build served by vite preview on 5190), so code edits
# made while a bot runs never reach a running page. Only touches this builder's own preview server.
S=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash
pkill -f "vite preview --outDir $S/snap --host 127.0.0.1 --port 5190" ; sleep 1
npx vite build --outDir $S/snap --emptyOutDir > $S/build-last.log 2>&1 || { echo BUILD FAILED; tail -20 $S/build-last.log; }
(nohup npx vite preview --outDir $S/snap --host 127.0.0.1 --port 5190 --strictPort > $S/preview.log 2>&1 &)
for i in 1 2 3 4 5 6 7 8 9 10; do sleep 1; curl -s -o /dev/null http://127.0.0.1:5190/ && break; done
echo "rebuilt $(date +%T) $(git -C . diff --stat | tail -1)"
