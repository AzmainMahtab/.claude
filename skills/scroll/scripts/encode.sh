#!/bin/bash
# encode.sh — encode rendered clips for scroll-scrubbing, and produce the free
# tier-1 mobile variant in the same pass.
#
#   bash encode.sh <src.mp4|srcdir> <outdir> [options]
#
#   --no-mobile      skip the tier-1 re-encode (desktop only)
#   --portrait       treat sources as the native 9:16 chain -> "-p.mp4" (tier 2)
#   --crf N          desktop crf (default 20)
#   --crf-mobile N   tier-1 crf (default 23)
#   --gop N          desktop GOP (default 8)
#   --gop-mobile N   tier-1 GOP (default 4)
#
# The tier-1 file is a pure RE-ENCODE of the desktop master. It costs nothing to
# produce and no extra generation — which is why it is on by default. Only the
# native 9:16 portrait chain (--portrait, fed by separately rendered sources)
# costs money.
#
# Why these settings:
#   -g 8 / -g 4   seek cost is dominated by frames-decoded-from-keyframe. Normal
#                 web video is GOP 48-250; dense keyframes are what make a scrub
#                 feel attached to the finger. They also roughly double bitrate —
#                 that trade is the format's whole cost model.
#   -an           no audio: the page mutes anyway, and it dodges autoplay policy.
#   +faststart    moov at the head.
#   unsharp       video is inherently softer than the stills; this claws some back.
#   NEVER upscale — encode what ffprobe reports.
#
# bash 3.2 safe (macOS): no associative arrays, no mapfile.
set -euo pipefail

SRC="${1:-}"; OUT="${2:-}"
if [ -z "$SRC" ] || [ -z "$OUT" ]; then
  sed -n '2,12p' "$0" >&2; exit 2
fi
shift 2

MOBILE=1; PORTRAIT=0; CRF=20; CRF_M=23; GOP=8; GOP_M=4
while [ $# -gt 0 ]; do
  case "$1" in
    --no-mobile)    MOBILE=0 ;;
    --portrait)     PORTRAIT=1 ;;
    --crf)          CRF="$2"; shift ;;
    --crf-mobile)   CRF_M="$2"; shift ;;
    --gop)          GOP="$2"; shift ;;
    --gop-mobile)   GOP_M="$2"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

command -v ffmpeg  >/dev/null 2>&1 || { echo "ffmpeg not on PATH"  >&2; exit 3; }
command -v ffprobe >/dev/null 2>&1 || { echo "ffprobe not on PATH" >&2; exit 3; }

mkdir -p "$OUT"

human() { awk -v b="$1" 'BEGIN{ if (b>1048576) printf "%.1f MB", b/1048576; else printf "%.0f KB", b/1024 }'; }

# Encode one file. $1 src, $2 dest, $3 crf, $4 gop, $5 extra -vf prefix ("" or scale)
enc_one() {
  _src="$1"; _dst="$2"; _crf="$3"; _gop="$4"; _scale="$5"
  _vf="unsharp=5:5:0.8:5:5:0.0"
  [ -n "$_scale" ] && _vf="${_scale},unsharp=5:5:0.6:5:5:0.0"
  ffmpeg -nostdin -v error -y -i "$_src" -an -vf "$_vf" \
    -c:v libx264 -preset slow -crf "$_crf" -pix_fmt yuv420p \
    -g "$_gop" -keyint_min "$_gop" -sc_threshold 0 \
    -movflags +faststart "$_dst"
}

# Verify one encoded file against the contract. Prints a line; returns non-zero on failure.
verify() {
  _f="$1"; _want_gop="$2"
  _info=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,nb_frames -of csv=p=0 "$_f")
  _w=$(echo "$_info" | cut -d, -f1)
  _h=$(echo "$_info" | cut -d, -f2)
  _n=$(echo "$_info" | cut -d, -f4)
  _audio=$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$_f" | wc -l | tr -d ' ')
  _kf=$(ffprobe -v error -select_streams v:0 -show_entries frame=key_frame -of csv=p=0 "$_f" | grep -c '^1' || true)
  _moov=$(head -c 4000 "$_f" | LC_ALL=C grep -c moov || true)
  _bytes=$(wc -c < "$_f" | tr -d ' ')

  _fail=""
  [ "$_audio" -ne 0 ] && _fail="$_fail audio-track"
  [ "$_moov" -eq 0 ] && _fail="$_fail no-faststart"
  if [ -n "$_n" ] && [ "$_n" != "N/A" ] && [ "$_kf" -gt 0 ]; then
    _actual=$(( _n / _kf ))
    [ "$_actual" -gt "$(( _want_gop + 2 ))" ] && _fail="$_fail gop~${_actual}(want ${_want_gop})"
  fi

  if [ -n "$_fail" ]; then
    printf '  ✗ %-26s %sx%s  %s  FAIL:%s\n' "$(basename "$_f")" "$_w" "$_h" "$(human "$_bytes")" "$_fail"
    return 1
  fi
  printf '  ✓ %-26s %sx%s  %s  gop~%s\n' "$(basename "$_f")" "$_w" "$_h" "$(human "$_bytes")" "$(( _kf > 0 ? _n / _kf : 0 ))"
  return 0
}

# Collect sources without mapfile (bash 3.2).
LIST=""
if [ -d "$SRC" ]; then
  for f in "$SRC"/*.mp4; do [ -e "$f" ] && LIST="$LIST$f
"; done
else
  LIST="$SRC
"
fi
[ -n "$LIST" ] || { echo "no .mp4 sources found in $SRC" >&2; exit 4; }

FAILED=0
echo "encoding -> $OUT"

# Here-string, not a pipe: a `while` on the right of a pipe runs in a subshell
# and every FAILED=1 set inside it is discarded when the subshell exits.
while IFS= read -r f; do
  [ -n "$f" ] || continue

  name=$(basename "$f" .mp4)

  if [ "$PORTRAIT" -eq 1 ]; then
    # Tier 2. Sources are already native 9:16 renders — scale to 720 wide, never up.
    dst="$OUT/${name}-p.mp4"
    enc_one "$f" "$dst" "$CRF_M" "$GOP_M" "scale=720:-2"
    verify "$dst" "$GOP_M" || FAILED=1
    continue
  fi

  # Desktop master — native resolution, never upscaled.
  dst="$OUT/${name}.mp4"
  enc_one "$f" "$dst" "$CRF" "$GOP" ""
  verify "$dst" "$GOP" || FAILED=1

  # Tier 1 — a re-encode of the master we just made. Free, but only worth
  # shipping if it is actually lighter.
  #
  # Halving the GOP (8 -> 4) costs roughly 25-40% MORE bitrate at the same crf,
  # because a keyframe is far more expensive than a P-frame. So a "mobile" encode
  # at the master's own resolution comes out BIGGER than the master — measured:
  # a 720p master at crf20/-g8 was 3.4 MB, its -g4/crf23 twin was 4.1 MB. The
  # resolution drop is what has to pay for the extra keyframes, so tier 1 always
  # steps the height down, and we verify the result rather than assuming it.
  if [ "$MOBILE" -eq 1 ]; then
    srch=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$dst")
    if   [ "$srch" -gt 1080 ]; then th=720
    elif [ "$srch" -gt 720 ];  then th=720
    elif [ "$srch" -gt 540 ];  then th=540
    elif [ "$srch" -gt 360 ];  then th=360
    else th="$srch"
    fi

    dstm="$OUT/${name}-m.mp4"
    enc_one "$dst" "$dstm" "$CRF_M" "$GOP_M" "scale=-2:${th}"

    master_b=$(wc -c < "$dst" | tr -d ' ')
    mob_b=$(wc -c < "$dstm" | tr -d ' ')
    # Tier 1 exists to be lighter. If it is not clearly lighter, spend quality
    # before spending resolution: a 540p file at crf 26 still looks right on a
    # phone at 3x DPR, where a 404p one visibly does not. Only if crf alone
    # cannot get there do we step the height down.
    if [ "$mob_b" -ge $(( master_b * 75 / 100 )) ]; then
      echo "    · ${name}-m.mp4 only $(human "$mob_b") vs master $(human "$master_b") — retrying at ${th}p crf $(( CRF_M + 3 ))"
      enc_one "$dst" "$dstm" "$(( CRF_M + 3 ))" "$GOP_M" "scale=-2:${th}"
      mob_b=$(wc -c < "$dstm" | tr -d ' ')
    fi
    if [ "$mob_b" -ge $(( master_b * 75 / 100 )) ]; then
      th2=$(( th * 3 / 4 )); th2=$(( th2 - th2 % 2 ))
      [ "$th2" -lt 360 ] && th2=360
      echo "    · still heavy — stepping down to ${th2}p"
      enc_one "$dst" "$dstm" "$(( CRF_M + 3 ))" "$GOP_M" "scale=-2:${th2}"
      mob_b=$(wc -c < "$dstm" | tr -d ' ')
    fi

    verify "$dstm" "$GOP_M" || FAILED=1
    pct=$(awk -v a="$mob_b" -v b="$master_b" 'BEGIN{printf "%.0f", (1-a/b)*100}')
    if [ "$mob_b" -ge "$master_b" ]; then
      echo "  ✗ ${name}-m.mp4 is heavier than its master — do not ship this tier"
      FAILED=1
    else
      echo "    · tier 1 is ${pct}% lighter than the master"
    fi
  fi
done <<< "$LIST"

# Payload summary — the number the original skill never printed.
echo
D=$(find "$OUT" -name '*.mp4' ! -name '*-m.mp4' ! -name '*-p.mp4' -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')
M=$(find "$OUT" -name '*-m.mp4' -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')
P=$(find "$OUT" -name '*-p.mp4' -exec wc -c {} + 2>/dev/null | tail -1 | awk '{print $1}')
[ -n "$D" ] && echo "  desktop chain : $(human "${D:-0}")"
[ -n "$M" ] && [ "${M:-0}" -gt 0 ] && echo "  tier 1 (phone): $(human "$M")"
[ -n "$P" ] && [ "${P:-0}" -gt 0 ] && echo "  tier 2 (9:16) : $(human "$P")"
echo
echo "Run: node scripts/budget.mjs $OUT   # to check these against the ceiling"

exit "$FAILED"
