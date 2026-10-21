#!/bin/sh
# Round 48 fix pass: the critic's casual pilot, one run at a time (parallel runs starve the control loop).
# PORT=5396 (pre-fix dist) or 5397 (fixed dist). ./fixruns.sh <prefix> > log
P=$1
PORT=$PORT node pilot48-fix.mjs ${P}-s130-casual "?seed=130" casual
PORT=$PORT node pilot48-fix.mjs ${P}-daily-casual "?daily=2026-10-20" casual
PORT=$PORT node pilot48-fix.mjs ${P}-s23085-casual "?seed=23085" casual
PORT=$PORT node pilot48-fix.mjs ${P}-phone-daily-casual "?daily=2026-10-20" casual phone
PORT=$PORT node pilot48-fix.mjs ${P}-phone-s130-casual "?seed=130" casual phone
