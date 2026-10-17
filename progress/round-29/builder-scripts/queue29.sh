#!/bin/zsh
# Round 29 builder (copy of round 27 queue): real-time (timing-sensitive) jobs, strictly one at a time. Reads jobs from jobs29.txt line by line
# (so jobs can be appended while it runs). A line "END" stops it.
cd "$(dirname "$0")"
QL=${I0:-1}
while true; do
  line=$(sed -n "${QL}p" jobs29.txt)
  if [ -z "$line" ]; then sleep 3; continue; fi
  [ "$line" = "END" ] && break
  echo "START $QL $(date +%T) $line"
  eval "$line"
  echo "DONE $QL $(date +%T)"
  QL=$((QL+1))
done
echo "ALLDONE $(date +%T)"
