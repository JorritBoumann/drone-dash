#!/bin/zsh
# Round 34 builder: browser jobs strictly one at a time, read line by line from jobs34.txt (append while it runs). "END" stops it.
cd "$(dirname "$0")"
i=1
while true; do
  line=$(sed -n "${i}p" jobs34.txt)
  if [ -z "$line" ]; then sleep 3; continue; fi
  [ "$line" = "END" ] && break
  echo "START $i $(date +%T) $line"
  eval "$line"
  echo "DONE $i $(date +%T)"
  i=$((i+1))
done
echo "ALLDONE $(date +%T)"
