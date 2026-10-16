#!/bin/zsh
# Round 20 builder: carry farms (deterministic). Honest baseline (capfarm honest) and the critic's narrow carry farms
# (tunnel, alley, van) with 12 s and 25 s farm phases, plus the round 18 carry and both farms, on 22, 58, 130.
cd "$(dirname "$0")"; O=../builder/farms; mkdir -p $O
cf() { SEED=$2 MODE=$1 SIMT=600 nice -n 10 node capfarm.mjs > $O/capfarm-$1-$2.log 2>&1; }

cn() { SEED=$3 MODE=$1 FARMMAX=$2 SIMT=600 nice -n 10 node capfarm-narrow.mjs > $O/cfn-$1-$2-$3.log 2>&1; }
cf honest 22 & cf honest 58 & cf honest 130 & cn tunnel 12 22 & cn tunnel 12 58 & cn tunnel 12 130 & wait
cn tunnel 25 22 & cn tunnel 25 58 & cn tunnel 25 130 & cn alley 12 22 & cn alley 12 58 & cn alley 12 130 & wait
cn alley 25 22 & cn alley 25 58 & cn alley 25 130 & cn van 12 22 & cn van 12 58 & cn van 12 130 & wait
cn van 25 22 & cn van 25 58 & cn van 25 130 & cf carry 22 & cf carry 58 & cf carry 130 & wait
cf both 22 & cf both 58 & cf both 130 & ci 12 22 & ci 12 58 & ci 12 130 & wait
ci 25 22 & ci 25 58 & ci 25 130 & wait
echo DONE
