#!/bin/zsh
# builder tool: the timing-sensitive critic scripts, one at a time
cd "$(dirname $0)/.."
export SEEDS=22,58,130 SIMT=150
node route-play-rt-x-h.mjs > logs/rp-low.log 2>&1
LINE=high node route-play-rt-x-h.mjs > logs/rp-high.log 2>&1
OFF=0 CRUISE=10 NOBOOST=1 node balance-probe-h.mjs > logs/bp-lazy.log 2>&1
unset SEEDS SIMT
node hand-fly.mjs > logs/hf-desktop.log 2>&1
MOBILE=1 node hand-fly.mjs > logs/hf-mobile.log 2>&1
node acceptance-probe.mjs > logs/flat.log 2>&1
SEEDS=11,22,33,44,7,58,91,130 node arrival-metrics.mjs > logs/am-all.log 2>&1
touch logs/rt-batch.done
