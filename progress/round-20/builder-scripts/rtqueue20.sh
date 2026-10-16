#!/bin/zsh
# Round 20 builder: real-time jobs one at a time (never two browsers at once).
cd "$(dirname "$0")"
i=0
while IFS= read -r job; do
  i=$((i+1)); echo "START $i $(date +%H:%M:%S) $job"; eval "$job"; echo "DONE $i $(date +%H:%M:%S)"
done < rtjobs20.txt
echo "ALLDONE $(date +%H:%M:%S)"
