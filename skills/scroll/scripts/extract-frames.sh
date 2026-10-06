#!/bin/bash
# extract-frames.sh — pull the seam boundary frames out of rendered clips.
#
#   bash extract-frames.sh <workdir> [name1 name2 …]
#
# For every dive_<name>.mp4 in <workdir> it writes:
#   first_<name>.png   frame 0        — the establishing frame
#   last_<name>.png    final frame    — the interior frame
#
# and then prints the connector spec table: which prompt file, which two frames,
# what the output must be called.
#
# THE SEAM LAW: a connector's endpoints must be the ACTUAL RENDERED FRAMES of its
# neighbouring clips, never the original diorama still. Every render is slightly
# different; if a connector ends on a fresh render of "the kitchen" but the next
# dive starts on its own different render of the same kitchen, you get a pop that
# no crossfade can hide.
#
# RUN THIS WITH bash, NOT zsh. macOS defaults to zsh interactively, where arrays
# are 1-indexed — an array-driven chain loop there silently grabs the wrong
# scene's frames or errors on one that does not exist yet. That is why this is a
# script with a bash shebang instead of a loop you paste into a shell.
# bash 3.2 safe: no associative arrays, no mapfile.
set -euo pipefail

WORK="${1:-}"
if [ -z "$WORK" ]; then sed -n '2,6p' "$0" >&2; exit 2; fi
shift || true

command -v ffmpeg >/dev/null 2>&1 || { echo "ffmpeg not on PATH" >&2; exit 3; }
[ -d "$WORK" ] || { echo "no such directory: $WORK" >&2; exit 4; }

# Names come from the args, or from the dive_*.mp4 files present, in sorted order.
NAMES=""
if [ $# -gt 0 ]; then
  for n in "$@"; do NAMES="$NAMES$n
"; done
else
  for f in "$WORK"/dive_*.mp4; do
    [ -e "$f" ] || continue
    b=$(basename "$f" .mp4); NAMES="$NAMES${b#dive_}
"; done
fi
[ -n "$NAMES" ] || { echo "no dive_*.mp4 found in $WORK" >&2; exit 4; }

COUNT=0
echo "extracting boundary frames from $WORK"
echo "$NAMES" | while IFS= read -r n; do
  [ -n "$n" ] || continue
  src="$WORK/dive_$n.mp4"
  [ -e "$src" ] || { echo "  ✗ missing $src" >&2; continue; }

  # -ss 0 for the establishing frame; -sseof -0.15 for the interior frame. Going
  # exactly to the end lands past the last decodable frame on some encoders.
  ffmpeg -nostdin -v error -y -ss 0      -i "$src" -frames:v 1 -q:v 2 "$WORK/first_$n.png"
  ffmpeg -nostdin -v error -y -sseof -0.15 -i "$src" -frames:v 1 -q:v 2 "$WORK/last_$n.png"
  printf '  ✓ %-18s first_%s.png  last_%s.png\n' "$n" "$n" "$n"
done

# The connector table. Written out in full because "connector i joins scene i and
# i+1" is exactly the statement that goes wrong when a loop is off by one.
echo
echo "Connector spec — one row per connector, endpoints are REAL frames:"
echo
printf '| %-14s | %-22s | %-22s | %-20s | %-8s |\n' "Prompt file" "Start frame" "End frame" "Save as" "Status"
printf '|%s|%s|%s|%s|%s|\n' "----------------" "------------------------" "------------------------" "----------------------" "----------"

PREV=""; I=0
echo "$NAMES" | while IFS= read -r n; do
  [ -n "$n" ] || continue
  if [ -n "$PREV" ]; then
    I=$(( I + 1 ))
    printf '| %-14s | %-22s | %-22s | %-20s | %-8s |\n' \
      "conn_$I.txt" "last_$PREV.png" "first_$n.png" "conn_$I.mp4" "pending"
  fi
  PREV="$n"
done

echo
echo "Acceptance rule: the connector's start frame must be obeyed EXACTLY."
echo "The end frame only needs to land on the same composition — a Seedance-style"
echo "near-miss is covered by the engine's seam crossfade."
echo
echo "Verify once rendered: node scripts/seam-check.mjs $WORK"
