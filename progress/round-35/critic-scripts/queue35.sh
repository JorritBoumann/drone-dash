#!/bin/zsh
# Round 35 critic: every browser job strictly one at a time, from jobs35.txt line by line (append while it runs). "END" stops it.
cd "$(dirname "$0")"
export OUTDIR=/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/c35/shots/
mkdir -p $OUTDIR/raw
i=1
while true; do
  line=$(sed -n "${i}p" jobs35.txt)
  if [ -z "$line" ]; then sleep 3; continue; fi
  [ "$line" = "END" ] && break
  echo "START $i $(date +%T) $line"
  eval "$line"
  echo "DONE $i $(date +%T)"
  i=$((i+1))
done
echo "ALLDONE $(date +%T)"
