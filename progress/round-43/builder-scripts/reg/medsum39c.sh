#!/bin/zsh
# Round 39 critic (new): medal lines of route-play / balance logs (score, tier, breakdown and end screen checks).
for f in "$@"; do grep "^MEDAL\|^LINE\|^CRUISE\|^LAZY" $f | node -e 'for (const l of require("fs").readFileSync(0,"utf8").trim().split("\n")) { if (!l.startsWith("MEDAL")) console.log(l.slice(0,220)); else { const j=JSON.parse(l.slice(6)); console.log(process.argv[1], j.seed, j.finalScore, j.tierName, "bdOk", j.bdOk, "domOk", j.domOk); } }' $f; done
