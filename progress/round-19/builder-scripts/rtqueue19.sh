#!/bin/zsh
# Round 19 builder (copy of the round 18 critic runner): real-time (timing-sensitive) jobs, strictly one at a time. Reads jobs from rtjobs19.txt line by line
# (so jobs can be appended while it runs). A line "END" stops it.
cd "$(dirname "$0")"
i=1
while true; do
  line=$(sed -n "${i}p" rtjobs19.txt)
  if [ -z "$line" ]; then sleep 3; continue; fi
  [ "$line" = "END" ] && break
  echo "START $i $(date +%T) $line"
  eval "$line"
  echo "DONE $i $(date +%T)"
  i=$((i+1))
done
echo "ALLDONE $(date +%T)"
