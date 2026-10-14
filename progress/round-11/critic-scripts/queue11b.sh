#!/bin/zsh
# Round 11 critic, second half: the high line runs through music-run11 (same control logic as route-play-rt-x-m.mjs) with the capture on,
# so its crashes give crash cues with music under them. Then the flat-frame probe and the desktop medal journey (frame time).
cd "$(dirname "$0")"
echo "START high-tap $(date +%T)"; TAP=1 LINE=high SEEDS=22,58,130 SIMT=400 node music-run11.mjs > m-high.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "ALLDONE $(date +%T)"
