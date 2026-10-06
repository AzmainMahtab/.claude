# Render backends

<!-- The model roster, the Monid I/O contract, the qualification protocol and the
     provider gotchas are ported from lets-scroll (MIT, cyw —
     github.com/AzmainMahtab/lets-scroll). Every number here was measured by
     upstream against paid probes. -->

> **The catalog moves in both directions.** Seedance was text-to-video only until late July
> 2026, then gained first/last-frame support. Everything below was qualified **2026-07-25**.
> Re-run the qualification probes before betting a build on any of it — `monid inspect`,
> `higgsfield model get <job_type>`. Do not treat a dated table as current.

## The selection rule is capability, not preference

This skill only ships seamless output, so the only usable models are ones that can
frame-lock a seam: every chained clip must accept `--start-image`, and connectors also need
`--end-image`. **Skip anything whose media inputs are reference-only** — it can condition a
generation but not continue a shot, so it physically cannot hold a seam.

| Model | start / end image | Notes |
|---|---|---|
| `seedance_2_0` (default) | ✓ / ✓ | Full chain. `--mode std --resolution 1080p`. Touchy NSFW filter. |
| `kling3_0` | ✓ / ✓ | Full chain. **No `--resolution`** — `--mode std` returns 720p native; encode what ffprobe reports, never upscale. Sound defaults **on** → `--sound off`. Different content filter — the sanctioned NSFW fallback. |
| `seedance_2_0_mini` | ✓ / ✓ | Cheap draft tier that keeps frame-locking (720p). Run the whole chain here first, then re-render final legs on the full model. |

`kling3_0_turbo` frame-locks via `--start-image` but has **no `--end-image`** — architecture
A only, and a different flag set. Not in the roster.

`minimax_hailuo` (Hailuo-2.3) is the cheapest probe (~6 credits per 768p/6s vs 22–72) and
frame-locks at 33 dB, but rejects `end_image` — architecture A only. Output aspect follows
the input image, so hand it a 16:9 canvas, not a bare 3:2 still. One clip is not a chain:
qualify a leg-to-leg handoff before betting a build on it.

**One model for the whole chain.** Each renderer has its own motion, colour and grain
character; mixing models keeps *position* continuity but the character shift reads as a
subtle pop. The one sanctioned exception is the NSFW fallback for a single stubborn clip —
a slight shift on one 5s connector behind a crossfade beats a missing connector.

## Monid — the default chain biller

Monid's `bytedance /v1/video/seedance-2.0` is `seedance_2_0` served pay-per-USD. Both paid
probes passed on 2026-07-25:

- **Leg** (prompt + `first_frame`): frame 0 ≡ input still at **31.6 dB**, forward-glide
  prompt obeyed, billed the advertised cell ($0.279 / 480p 4s).
- **Connector** (prompt + `first_frame` + `last_frame`): start locked at 31.6 dB; the end
  lands close but not pixel-perfect (**27.5 dB**, same composition, prop-level drift) —
  covered by the engine's seam crossfade and by using the next dive's actual first frame.

Three rules that differ from the Higgsfield CLI:

1. **Images go by URL, never inline.** `content` items are
   `{"type":"image_url","image_url":{"url":…},"role":"first_frame"|"last_frame"}`. Base64
   data URLs are rejected. Local frames travel through Monid's free workspace file system:
   `sfs /put` → `curl -T` the bytes → `sfs /cat` returns a signed public URL. $0.
2. **Pass `ratio` explicitly** (`16:9`, or `9:16` for the tier-2 chain) — the adaptive
   default follows the input image's aspect instead.
3. **Bill-check every clip.** Cost is token-priced (`w × h × 24 × sec / 1024` at $7–7.7/1M);
   read `cost.value` off each run.

Measured: 1080p ≈ $2.99/dive, $1.87/connector. 720p ≈ $1.21 / $0.76. 480p previz ≈ $0.28 /
$0.35. **A 1080p N=6 chain is about $27.**

### Qualification protocol for any new or changed endpoint

Each probe is one cheap 480p clip.

1. Prompt + first-frame from a real still — frame 0 must match the input to codec noise
   (PSNR ≳30 dB) and `cost.value` must match the advertised cell.
2. For connector duty, add a `last_frame` from a different still — the end must land on that
   composition. A Seedance-style near-miss is fine.

Pass → pay-per-clip tier. Start-only → architecture A. Start+end → full roster.

`node scripts/seam-check.mjs` computes the same PSNR the protocol asks for.

## Stills

Default **`gpt_image_2`** (crisp, strong at isometric illustration, returns a solid
background — perfect for floating diorama islands). `nano_banana_2` only for
character/cartoon-heavy briefs; note it is a CLI alias resolving to `nano_banana_pro`.

Spec: 3:2 landscape, ≥1536px wide, solid background, no text. The aspect, background lock
and palette all live **in the prompt text**, because on the manual path each still may be
rendered in a different tool or session.

**Codex variant** — if `codex` ≥0.125 is on `$PATH` with a ChatGPT login, the same
`gpt_image_2` model is available through Codex's `image_gen`, billed to the subscription
instead of credits:

```bash
codex exec -C "$WORK" -s workspace-write --skip-git-repo-check \
  'Use the image generation tool ($imagegen) to generate: '"$(cat "$WORK/still_i.txt")"' Wide 3:2 landscape, high resolution. Save it as ./still_i.png. Do not do anything else.' \
  < /dev/null
```

Single-quote the `$imagegen` segment. **Keep the `< /dev/null`**: parallel `codex exec` calls
launched from one script share the parent's stdin, one wins it and the rest block forever.

## Manual path

The user renders everything themselves; the skill supplies prompts and conditioning frames.
Skip the roster entirely. The architecture choice still stands, and the frame-lock rule is
unchanged — confirm their tool **accepts a start frame**, and for architecture B's
connectors, an **end frame**. If it cannot take an end frame, either re-confirm architecture
A or have them use a tool that can. Never ship unseamed connectors.

Every manual handoff is **always a spec table**, never a prose list: prompt file,
conditioning frame(s), exact output filename, and a status column kept current
(pending / rendered / accepted). `extract-frames.sh` prints it.

Validate before chaining: plays, right aspect, duration ≈ spec, and **frame 0 matches the
handed-over start frame**. A clip whose tool ignored the start image cannot hold its seam —
send it back, do not crossfade over it.

## Gotchas

- **NSFW false-positives** — the video filter flags innocuous clips, especially bedroom,
  pool and spa contexts, and words like "bed", "pool", "waterfall", "wine", "swim". In
  order: re-roll (often passes on the 2nd–3rd try); strip trigger words and add "empty,
  unoccupied, no people, architectural, tasteful"; regenerate that clip on `kling3_0` with
  the same frames. Last resort: set the connector slot to `null` — the engine crossfades
  that seam directly and the page still completes.
- **`--generate-audio` errors on seedance** — omit it. Mute in HTML, `-an` on encode.
- **Concurrent gens 503 / "not_enough_credits"** — transient when many launch at once.
  Re-roll the individual failure.
- **Monid "Polling timed out after 120s"** — only the local wait died; the run continues
  server-side. Re-poll with `monid runs get -r <runId> -w 120`. Result URLs expire in
  24–48h — download immediately.
- **Monid minimax drops the image when a prompt is present** — returns unrelated t2v output
  AND bills the wrong cell. Use Monid's seedance-2.0.
- **ffmpeg eats stdin in a loop.** Any `while read` loop calling ffmpeg must pass
  `-nostdin`, or ffmpeg consumes the loop's input and the next iteration gets a truncated
  path. The shipped scripts all do; keep it if you adapt them.
- **bash 3.2 on macOS** — no associative arrays, no `mapfile`.
- **zsh is 1-indexed.** Keep every array-driven chain step in a `#!/bin/bash` script run via
  `bash script.sh`, never pasted into an interactive shell.
