#!/bin/zsh
cd "$(dirname "$0")"
until grep -q "DET20 DONE" det20.out; do sleep 5; done
./rtqueue20.sh > rtqueue20.log 2>&1
