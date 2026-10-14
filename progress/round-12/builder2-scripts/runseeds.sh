#!/bin/bash
# builder2: run route-play-rt-x-m.mjs one seed per process, retry once if the run died (page reload), append to LOG.
# usage: LINE=low LOG=x.log ./runseeds.sh 22 58 130
for s in "$@"; do
  for try in 1 2; do
    SEEDS=$s SIMT=${SIMT:-400} node ${SCRIPT:-route-play-rt-x-m.mjs} > .one.log 2>&1
    cat .one.log >> "$LOG"
    if grep -q '^MEDAL' .one.log; then break; fi
    echo "RETRY seed $s (try $try failed)" >> "$LOG"
  done
done
