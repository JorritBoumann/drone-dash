#!/bin/sh
# Round 48 builder: the bot matrix in parallel (one process per city). PORT, PROFILES, TUNE as for shift48.mjs.
# ./matrix48.sh out.log [seeds...]
OUT=$1; shift
SEEDS=${*:-22 58 130 daily 7 91 11 300}
: > $OUT
for s in $SEEDS; do SEEDS=$s node shift48.mjs > $OUT.$s 2>&1 & done
wait
for s in $SEEDS; do cat $OUT.$s >> $OUT; rm $OUT.$s; done
