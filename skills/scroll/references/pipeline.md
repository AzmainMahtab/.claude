# Pipeline — the whole run

<!-- Batch structure and the generation flags are ported from lets-scroll (MIT, cyw —
     github.com/AzmainMahtab/lets-scroll). The encode and extraction steps are now
     scripts rather than prose: scripts/encode.sh, scripts/extract-frames.sh. -->

Set up once:

```bash
SKILL=.claude/skills/scroll
WORK=work                 # scratch: prompts, raw renders, extracted frames. NEVER shipped.
SITE=public/scroll        # shipped: encoded clips only.
mkdir -p "$WORK" "$SITE"

VMODEL=seedance_2_0
VOPTS="--mode std --resolution 1080p"    # kling3_0: "--mode std --sound off", no --resolution
DIVE_DUR=8; CONN_DUR=5
```

`work/` versus `public/scroll/` is the whole of step 9. Keep them separate from the first
command and there is nothing to clean up at the end.

## 0 — Bootstrap

```bash
monid --version && monid keys list && monid balance    # default chain biller
higgsfield workspace list                              # stills, and the NSFW fallback
ffmpeg -version && ffprobe -version
node "$SKILL/scripts/budget.mjs" --estimate --scenes "$N" --res 1080p
```

That last line is not optional. It prints the payload you are about to commit to, next to
the spend. Both get approved before anything renders. See `budget.md`.

## 0.5 — Write the prompts

Both paths. Put the interview into `$WORK/scenes.json`:

```json
{
  "brand": "Pearl & Co.", "style": "clay", "bg": "#F3EDE3",
  "palette": "warm cream, terracotta, sage, deep navy",
  "arch": "b", "diveDur": 8, "connDur": 5,
  "scenes": [
    { "id": "farm", "subject": "a terraced tea farm on a hillside, drying racks",
      "focal": "the drying racks under the open shed" },
    { "id": "shop", "subject": "a small tea shop counter with brass scales and tins",
      "focal": "the brass scales" }
  ]
}
```

```bash
node "$SKILL/scripts/intake.mjs" --plan "$WORK" --spec "$WORK/scenes.json"
```

Writes `still_<id>.txt`, `dive_<id>.txt` (or `leg_<id>.txt`), `conn_<i>.txt` and
`WORKSHEET.md`. `--styles` lists the six art directions.

## Manual path — no CLI, no subscription

Skip sections 1, 2 and 4 entirely. Hand the user `WORKSHEET.md`: every row is one render,
with its prompt file, the conditioning frame(s) to upload, the exact output filename and the
spec. They work down it in any tool — Kling, Runway, Sora, a web UI with no API — and drop
results into `$WORK/`.

Two constraints to state before they start:

- The tool **must accept a start frame**. Architecture B connectors also need an **end**
  frame; without one, switch to architecture A rather than shipping unseamed joins.
- Order matters. B: dives in any order, connectors only after the dives exist (their
  endpoints are extracted from them). A: strictly sequential.

As each batch lands:

```bash
node "$SKILL/scripts/intake.mjs" --check "$WORK" --spec "$WORK/scenes.json"
```

Decode, aspect, duration, audio, and frame 0 against its conditioning frame. Where that
frame came from this pipeline (a chained leg, any connector) a mismatch is a **FAIL** — the
tool ignored the start image and it will poison every clip after it. Where it is a 3:2 still
against a 16:9 clip, the script reports the number and the geometry rather than failing: a
renderer may legitimately letterbox, and a correctly-obeyed start image pillarboxed into
16:9 measures ~8 dB against its own still while being visibly the same scene. Pad the still
onto a 16:9 canvas first if you want a tight lock.

Then rejoin at section 3.

## 1 — Stills

One image per section, all sharing a **byte-identical style preamble** — that identical text
is what makes the world cohere. Templates in `prompts.md`.

```bash
for n in $NAMES; do
  higgsfield generate create gpt_image_2 \
    --prompt "$(cat "$WORK/still_$n.txt")" \
    --aspect_ratio 3:2 --resolution 2k --quality high \
    --wait --wait-timeout 15m --json > "$WORK/still_$n.json" 2>"$WORK/still_$n.err" &
done
wait
```

Result URL is `.[]0.result_url`. `curl` each down to `$WORK/still_<n>.png`.

**Review before continuing.** They must read as one world — same angle, palette, light. An
off-style still gets regenerated, optionally passing an approved sibling as `--image` to lock
style. This is the cheapest place in the whole pipeline to fix cohesion; it is very expensive
two steps later.

## 2 — Dives (architecture B) or legs (architecture A)

Read `seams.md` first and pick the architecture. B parallelises; A does not.

```bash
# B — all dives concurrently, each from its own scene still
for n in $NAMES; do
  higgsfield generate create "$VMODEL" \
    --prompt "$(cat "$WORK/dive_$n.txt")" \
    --start-image "$WORK/still_$n.png" \
    $VOPTS --aspect_ratio 16:9 --duration $DIVE_DUR --wait --json \
    > "$WORK/dive_$n.json" 2>"$WORK/dive_$n.err" &
done
wait
```

For A, render legs **sequentially**, each `--start-image` being the previous leg's actual
last frame, and **no `--end-image`**.

Renders take 3–8 minutes each — always detached, never a foreground blocking call. Re-roll
individual failures; do not restart the batch.

## 3 — Boundary frames

```bash
bash "$SKILL/scripts/extract-frames.sh" "$WORK"
```

Writes `first_<n>.png` / `last_<n>.png` for every dive and prints the connector spec table.

## 4 — Connectors (architecture B only)

```bash
higgsfield generate create "$VMODEL" \
  --prompt "$(cat "$WORK/conn_$i.txt")" \
  --start-image "$WORK/last_$prev.png" \
  --end-image   "$WORK/first_$next.png" \
  $VOPTS --aspect_ratio 16:9 --duration $CONN_DUR --wait --json
```

The endpoints are the extracted frames. Never the stills. `seams.md` explains why, at length,
because this is the failure everyone hits once.

## 5 — Verify the seams

```bash
node "$SKILL/scripts/seam-check.mjs" "$WORK" --order "$(echo $NAMES | tr ' ' ',')"
```

Two PSNR readings per seam — detail and composition. Fix any FAIL here; nothing downstream
can hide it.

## 6 — Encode

```bash
bash "$SKILL/scripts/encode.sh" "$WORK" "$SITE"
```

Produces the desktop master (native resolution, crf 20, `-g 8`, `+faststart`, no audio) and
the **free tier-1 phone variant** (`-m.mp4`, stepped-down height, `-g 4`) in one pass, then
verifies each with ffprobe and reports how much lighter tier 1 came out.

Tier 2 — the paid native 9:16 chain — is a separate render and a separate pass:

```bash
bash "$SKILL/scripts/encode.sh" "$WORK/portrait" "$SITE" --portrait
```

## 7 — Budget

```bash
node "$SKILL/scripts/budget.mjs" "$SITE"
```

Exits non-zero over the ceilings. If it fails, `budget.md` lists what to cut, cheapest first.

## 8 — Assemble

Astro: `astro.md`. Vanilla: copy `runtime/scrub-engine.js` and `demo/index.html`.

Posters come from the stills — knock out the background first if the scenes should float:

```bash
python3 "$SKILL/scripts/knockout.py" "$WORK/still_$n.png" "$SITE/../$n.png"
cwebp -q 82 "$SITE/../$n.png" -o "$SITE/../$n.webp"
```

Or skip it entirely and set the page background to the scene background colour.

## 9 — Ship

**What ships:** `index.html` (or the built Astro output), the engine, `public/scroll/*.mp4`,
the poster WebPs, the favicon.

**What does not:** `work/` — every prompt file, raw render, extracted PNG and JSON response.
It is typically larger than the site itself.

```bash
node "$SKILL/scripts/scroll-audit.mjs" http://localhost:4321/
node "$SKILL/scripts/scroll-audit.mjs" http://localhost:4321/ --mobile
```

Both must exit 0. The mobile pass is the one that catches a phone being served desktop
masters, which is the defect this format ships with most often.

## Previz

Run the entire chain on `seedance_2_0_mini` at 480p first (~$0.28/dive, $0.35/connector). It
keeps frame-locking, so the seams and the journey translate directly to the full render —
you are validating structure, not fidelity. On an N=6 chain that is roughly $4 to find out
that scene 3 should come before scene 2, instead of $27.
