#!/bin/zsh
cd "$(dirname "$0")"
until grep -q '^ALLDONE' queue.log 2>/dev/null; do sleep 3; done
echo "START mj-desktop $(date +%T)"; node medal-journey.mjs > mj-desktop.log 2>&1
echo "START mj-mobile $(date +%T)"; MOBILE=1 node medal-journey.mjs > mj-mobile.log 2>&1
echo "START mj-desktop-s58 $(date +%T)"; SEED=58 node medal-journey.mjs > mj-desktop-58.log 2>&1
echo "START journey $(date +%T)"; node journey.mjs > journey.log 2>&1
echo "START build $(date +%T)"; (cd ../../.. && npx vite build --outDir /private/tmp/claude-501/-Users-jorritboumann/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/dist --emptyOutDir) > build.log 2>&1
echo "ALLDONE2 $(date +%T)"
