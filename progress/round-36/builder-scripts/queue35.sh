#!/bin/zsh
# Round 35 builder queue: every browser job alone, one at a time, against my server on 5190 (never the owner's 5188).
cd "$(dirname "$0")"
export OUTDIR=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/out35/
while IFS= read -r job; do
  [ -z "$job" ] && continue
  echo "$(date +%T) START $job" >> queue35.log
  eval "$job"
  echo "$(date +%T) END rc=$?" >> queue35.log
done < "${1:-jobs35.txt}"
echo "$(date +%T) QUEUE DONE" >> queue35.log
