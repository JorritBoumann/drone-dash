#!/bin/zsh
cd "$(dirname "$0")"
cf() { SEED=$2 MODE=$1 SIMT=600 node capfarm.mjs > capfarm-$1-$2.log 2>&1; }
cf honest 22 & cf honest 58 & cf honest 130 & cf carry 22 & wait
cf carry 58 & cf carry 130 & cf both 22 & cf both 58 & wait
cf both 130 & wait
echo DONE
