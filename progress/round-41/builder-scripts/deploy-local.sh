#!/bin/sh
# Round 41: build, then copy dist to the nested (5291) and root (5293) static folders in the scratchpad.
SP=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad
cd /Users/jorritboumann/projects/browser-game-lab/games/drone-dash || exit 1
npm run build 2>&1 | grep -E "warn|error|index-|three-|built" 
rm -rf $SP/nest/nested/game/* $SP/root/*
cp -R dist/. $SP/nest/nested/game/ && cp -R dist/. $SP/root/
