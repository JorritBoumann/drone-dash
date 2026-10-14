#!/bin/zsh
# builder tool: run the deterministic sim for the four pilots, seeds 22 58 130
cd "$(dirname $0)/.."
export SEEDS=${SEEDS:-22,58,130} SIMT=150
node tools/sim.mjs 2>&1 | grep SUMMARY &
CRUISE=10 NOBOOST=1 node tools/sim.mjs 2>&1 | grep SUMMARY &
LINE=high node tools/sim.mjs 2>&1 | grep SUMMARY &
OFF=5.5 node tools/sim.mjs 2>&1 | grep SUMMARY &
wait
