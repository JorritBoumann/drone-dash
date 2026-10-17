#!/bin/zsh
# Round 31 builder: regression probes, strictly one browser at a time (port 5190).
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-31/builder-scripts
echo "START $(date +%T)"
node acceptance-probe.mjs > flat.log 2>&1; echo "flat $(date +%T)"
node traffic-det29.mjs > traffic-det31.log 2>&1; echo "traffic $(date +%T)"
node pad-people23.mjs > pad-people.log 2>&1; echo "people $(date +%T)"
ALT=12 SEEDS=22,58,130 node crash-classify-v.mjs > ccv12.log 2>&1; echo "ccv12 $(date +%T)"
ALT=20 SEEDS=22,58,130 node crash-classify-v.mjs > ccv20.log 2>&1; echo "ccv20 $(date +%T)"
SEED=130 node trisweep29.mjs > trisweep-d-130.log 2>&1
node trisweep29.mjs > trisweep-d-22.log 2>&1
MOBILE=1 SEED=130 node trisweep29.mjs > trisweep-m-130.log 2>&1; echo "tris $(date +%T)"
ps -Ao pcpu,comm -r | head -3 > cpu-ff.txt; DEV=desktop RUNS=2 node ff29.mjs > ff-d.log 2>&1
DEV=iphone RUNS=1 node ff29.mjs > ff-m.log 2>&1; echo "ff $(date +%T)"
NEW=1 DEV=iphone SEED=22 LOWT=80 HIGHT=0 CAM=1 PFX=raw/fr31- node hud-probe28.mjs > fr-m-22.log 2>&1; echo "hud $(date +%T)"
for s in 22 58 130; do SEED=$s ROAD=66 OFF=6.5 SIMT=600 node farm-probe.mjs > farm-$s.log 2>&1; done; echo "farm $(date +%T)"
ps -Ao pcpu,comm -r | head -3 > cpu-perf-street.txt; node perf-street.mjs > perf-street-d.log 2>&1
MOBILE=1 node perf-street.mjs > perf-street-m.log 2>&1; echo "perf $(date +%T)"
ps -Ao pcpu,comm -r | head -3 > cpu-medal.txt; LINE=low SEEDS=22,58,130 SIMT=600 node route-play-rt-x-m-esc17.mjs > m-low-a.log 2>&1; echo "medal $(date +%T)"
echo ALLDONE
