#!/bin/zsh
# Round 22 builder: acceptance + regression queue, strictly one browser at a time, port 5190.
cd "$(dirname "$0")"
echo "START $(date +%T)"
TAG=after SEED=22 RUSH=1 node street-shots.mjs > shots-d-22.log 2>&1
TAG=after SEED=4 RUSH=1 node street-shots.mjs > shots-d-4.log 2>&1
TAG=after SEED=22 MOBILE=1 node street-shots.mjs > shots-m-22.log 2>&1
TAG=after SEED=4 MOBILE=1 RUSH=1 node street-shots.mjs > shots-m-4.log 2>&1; echo "shots $(date +%T)"
for M in 0 1; do for P in none traffic all; do
  if [ $M = 1 ]; then MOBILE=1 NOSHOTS=1 TAG=parts SEED=22 PARTS=$P node street-shots.mjs > parts-m-$P.log 2>&1; else NOSHOTS=1 TAG=parts SEED=22 PARTS=$P node street-shots.mjs > parts-d-$P.log 2>&1; fi
done; done; echo "parts $(date +%T)"
SIMT=60 node traffic-probe.mjs > traffic.log 2>&1; echo "traffic $(date +%T)"
node ped-probe.mjs > people.log 2>&1; echo "people $(date +%T)"
SEED=22 node van-probe.mjs > van.log 2>&1; echo "van $(date +%T)"
node orbit-desktop.mjs > orbit-desktop.log 2>&1; echo "orbit $(date +%T)"
./regress22.sh > regress22.out 2>&1
echo "DONE $(date +%T)"
