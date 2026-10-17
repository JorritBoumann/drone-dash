#!/bin/zsh
# Round 31: camera acceptance runs, one browser at a time.
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash
S=progress/round-31/builder-scripts
ps -Ao pcpu,comm -r | head -3 > $S/cpu-cam.txt
SEED=22 node $S/cam-clip24.mjs > $S/cam-clip24-22.log 2>&1
SEED=58 node $S/cam-clip24.mjs > $S/cam-clip24-58.log 2>&1
MOBILE=1 NOORBIT=1 SEED=22 node $S/cam-clip24.mjs > $S/cam-clip24-m-22-noorbit.log 2>&1
node $S/climb30.mjs > $S/climb30-d.log 2>&1
MOBILE=1 node $S/climb30.mjs > $S/climb30-m.log 2>&1
echo done
