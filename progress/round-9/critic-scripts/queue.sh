#!/bin/zsh
# Round 9 critic: run every timing-sensitive script one at a time.
cd "$(dirname "$0")"
until grep -q '^done' /private/tmp/claude-501/-Users-jorritboumann/c70bfd6f-b51c-4910-b300-7e4c0c36b628/tasks/bmcmve1g9.output 2>/dev/null; do sleep 2; done
echo "START low $(date +%T)"; LINE=low SEEDS=22,58,130 SIMT=400 node route-play-rt-x-m.mjs > m-low.log 2>&1
echo "START high $(date +%T)"; LINE=high SEEDS=22,58,130 SIMT=400 node route-play-rt-x-m.mjs > m-high.log 2>&1
echo "START hf-desktop $(date +%T)"; node hand-fly.mjs > hf-desktop.log 2>&1
echo "START hf-mobile $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile.log 2>&1
echo "START hf-mobile-2 $(date +%T)"; MOBILE=1 node hand-fly.mjs > hf-mobile-2.log 2>&1
echo "START hug $(date +%T)"; node hug-probe.mjs > hug.log 2>&1
echo "START flat $(date +%T)"; node acceptance-probe.mjs > flat.log 2>&1
echo "START cc12 $(date +%T)"; ALT=12 node crash-classify.mjs > cc12.log 2>&1
echo "START cc20 $(date +%T)"; ALT=20 node crash-classify.mjs > cc20.log 2>&1
echo "START ccv12 $(date +%T)"; ALT=12 node crash-classify-v.mjs > ccv12.log 2>&1
echo "START ccv20 $(date +%T)"; ALT=20 node crash-classify-v.mjs > ccv20.log 2>&1
echo "START am $(date +%T)"; SEEDS=11,22,33,44,7,58,91,130 node arrival-metrics.mjs > am-all.log 2>&1
echo "ALLDONE $(date +%T)"
