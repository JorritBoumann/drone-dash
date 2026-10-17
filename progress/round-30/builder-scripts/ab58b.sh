#!/bin/zsh
# Round 30 builder: camera-vs-heading trace of the deterministic street bot on seed 58 (round 30 on 5190, round 29 on 5193).
cd "$(dirname "$0")"
(cd /private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r29 && npx vite --host 127.0.0.1 --port 5193 --strictPort > /private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/vite-r29.log 2>&1 &); sleep 6
for port in 5190 5193; do PORT=$port LINE=low SEEDS=58 SIMT=100 TRACE_FROM=0 node route-play-trace.mjs > rp-low-58-cam-trace-$port.log 2>&1; done
pkill -f 'port 5193'
echo ABDONE
