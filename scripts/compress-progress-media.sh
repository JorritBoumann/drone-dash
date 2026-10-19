#!/usr/bin/env bash
# Converts untracked progress media to small formats before a commit:
# screenshots (png/jpg) to WebP quality 80, audio (wav) to Ogg Opus 96 kbps.
# Originals stay on disk and are ignored by .gitignore; the WebP and Ogg files go to Git LFS.
# Needs: brew install webp opus-tools
set -euo pipefail
cd "$(dirname "$0")/.."

# Read the tracked files once (rounds 1 to 11 committed their originals).
tracked=$(mktemp)
trap 'rm -f "$tracked"' EXIT
git ls-files progress | sort > "$tracked"

converted=0
while IFS= read -r f; do
  case "$f" in
    *.png|*.jpg|*.jpeg) out="${f%.*}.webp" ;;
    *.wav) out="${f%.*}.ogg" ;;
    *) continue ;;
  esac
  [ -e "$out" ] && continue                                  # already converted
  grep -qxF "$f" "$tracked" && continue                      # original is tracked
  case "$f" in
    *.wav) opusenc --quiet --bitrate 96 "$f" "$out" ;;
    *) cwebp -quiet -q 80 "$f" -o "$out" ;;
  esac
  converted=$((converted + 1))
done < <(find progress -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.wav' \) | sort)

echo "compress-progress-media: $converted new files"
