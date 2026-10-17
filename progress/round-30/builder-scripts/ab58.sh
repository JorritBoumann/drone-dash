#!/bin/zsh
# Round 30 builder: deterministic street bot on seed 58, round 30 (5190) against round 29 (5193), camera heading and yaw heading.
cd "$(dirname "$0")"
(cd /private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r29 && npx vite --host 127.0.0.1 --port 5193 --strictPort > /private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/vite-r29.log 2>&1 &); sleep 6
for port in 5190 5193; do
  PORT=$port LINE=low SEEDS=58 SIMT=300 node route-play-trace.mjs > rp-low-58-cam-$port.log 2>&1
  PORT=$port LINE=low SEEDS=58 SIMT=300 HEAD=yaw node route-play-trace.mjs > rp-low-58-yaw-$port.log 2>&1
done
pkill -f 'port 5193'
echo ABDONE
