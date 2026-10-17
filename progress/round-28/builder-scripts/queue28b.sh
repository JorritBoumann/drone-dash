#!/bin/zsh
# Round 28 builder (copy of the round 27 queue): real-time (timing-sensitive) jobs, strictly one at a time. Reads jobs from jobs28b.txt line by line
# (so jobs can be appended while it runs). A line "END" stops it.
cd "$(dirname "$0")"
i=1
while true; do
  line=$(sed -n "${i}p" jobs28b.txt)
  if [ -z "$line" ]; then sleep 3; continue; fi
  [ "$line" = "END" ] && break
  echo "START $i $(date +%T) $line"
  eval "$line"
  echo "DONE $i $(date +%T)"
  i=$((i+1))
done
echo "ALLDONE $(date +%T)"
