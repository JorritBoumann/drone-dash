#!/bin/zsh
# Round 10 critic: every timing-sensitive script one at a time.
cd "$(dirname "$0")"
echo "START toggle $(date +%T)"; node toggle-test.mjs > toggle.log 2>&1
echo "START music22 $(date +%T)"; TAP=1 LINE=low SEEDS=22 SIMT=400 node music-run.mjs > music-22.log 2>&1
echo "START music58-130 $(date +%T)"; LINE=low SEEDS=58,130 SIMT=400 node music-run.mjs > music-58-130.log 2>&1
echo "START high $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=400 node route-play-rt-x-m.mjs > m-high.log 2>&1
echo "START lazy $(date +%T)"; CRUISE=10 NOBOOST=1 SEEDS=22,58,130 SIMT=400 node balance-probe-m.mjs > m-lazy.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "START mj-mobile $(date +%T)"; MOBILE=1 node medal-journey.mjs > mj-mobile.log 2>&1
echo "START ccv12 $(date +%T)"; ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1
echo "START ccv20 $(date +%T)"; ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1
echo "START build $(date +%T)"; (cd ../../.. && npx vite build --outDir /private/tmp/claude-501/-Users-jorritboumann/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/dist10 --emptyOutDir) > build.log 2>&1
echo "ALLDONE $(date +%T)"
