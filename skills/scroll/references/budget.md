# Budget — what the page costs, in dollars and in bytes

The upstream skill prices every clip in dollars, to three decimal places, and never once
says what the page will weigh. This file is the other half of that decision. Both numbers
get approved at the same moment, at the interview, before anything is rendered.

## The two gates

| Gate | Script | When |
|---|---|---|
| Estimate | `node scripts/budget.mjs --estimate --scenes N --res 1080p` | At the interview, before spending |
| Measured | `node scripts/budget.mjs <dir>` | After `encode.sh`, before assembling |
| At the wire | `node scripts/scroll-audit.mjs <url> [--mobile]` | Before shipping |

Estimate and measured check the same ceilings. The audit checks what the browser actually
pulled, which is the only number a visitor experiences.

## Weight is only half of "shippable"

The measured and wire gates both also refuse **placeholder media**, and that check is not a
byte check at all.

A scaffold build — `placeholder.mjs`, SKILL step 2.5 — produces a chain that is comfortably
within every ceiling precisely because it is synthetic. 3.8 MB of gradients passes the
payload gate, scores Performance 100, and is completely unshippable. Nothing in this file's
arithmetic can tell the difference, so provenance is asserted separately:

| Where | What it catches |
|---|---|
| `budget.mjs <dir>` | Stand-ins sitting in the directory about to be deployed |
| `scroll-audit.mjs <url>` | Stand-ins already being served — the only check that runs against production |

The marker (`SCROLL_PLACEHOLDER_V1`) lives inside the media's own bytes, not in a sidecar
manifest. A manifest fails in the wrong direction: delete it, keep the files, and the gates
go green. An embedded stamp can only disappear by **replacing the file**, which is exactly
the action that makes shipping safe — the same fail-safe reasoning as the tier fallback,
where a missing tier file drops to stills rather than to the heavy master.

It survives `encode.sh` because `enc_one()` passes no `-map_metadata`, so ffmpeg copies
global metadata from input 0 by default. That is load-bearing and pinned by
`test-placeholder.mjs`; adding `-map_metadata -1` for hygiene would blind every gate here.

Clearing it is not a step. Replace the file and the stamp is gone.

## Ceilings

Per **scene**, because that is how the format scales — a scene is one dive plus, usually,
one connector.

| | Per scene | Hard cap |
|---|---|---|
| Desktop chain | 6.0 MB | 40 MB |
| Tier 1 (phone) | 2.0 MB | 12 MB |
| Tier 2 (phone) | 2.0 MB | 12 MB |
| Stills | 120 KB | — |
| Engine | — | 40 KB (≈11 KB minified) |

And two that are not about totals at all:

| | Ceiling |
|---|---|
| Bytes before the **first** scene can move — desktop | 5 MB |
| Bytes before the first scene can move — phone | 2.5 MB |

That last pair is the number the visitor actually feels. A 16 MB page whose opening dive is
1.5 MB feels fast. A 9 MB page whose opening dive is 4 MB feels broken. Nothing upstream
tracks it.

## The three tiers

The insight the original skill misses: **a tier-1 mobile clip is a pure ffmpeg re-encode of
the desktop master.** It costs $0 and requires no extra generation. Only the native 9:16
portrait chain costs money.

| Tier | Phone gets | Render cost | Default |
|---|---|---|---|
| 0 `stills` | WebP posters, cross-dissolving. Zero video bytes. | $0 | Forced under reduced-motion and Save-Data |
| 1 `light` | 540–720p `-g 4` re-encode of the master | **$0** | **Yes** |
| 2 `portrait` | Native 9:16 render | **+2N−1 generations** — roughly doubles the spend | Explicit opt-in |

Responsive **layout** is always on at every tier. Only the video is tiered.

The fallback direction is the whole point: if the configured tier's file is missing, a phone
gets **stills**, never the desktop master. Upstream falls back the other way, which is how a
measured build ended up serving 16 MB of 720p masters to phones.

## Why tier 1 has to drop resolution

Halving the GOP from 8 to 4 costs roughly 25–40% **more** bitrate at the same crf, because a
keyframe is far more expensive than a P-frame. So a "mobile" encode at the master's own
resolution comes out *bigger than the master*. Measured on a real 720p clip:

| | Size |
|---|---|
| Master, crf 20, `-g 8`, 1280×720 | 3.4 MB |
| Naive "mobile", crf 23, `-g 4`, 1280×720 | **4.1 MB** |
| Tier 1, crf 26, `-g 4`, 960×540 | 2.0 MB |

The resolution step is what pays for the extra keyframes. `encode.sh` measures the result
and refuses to ship a `-m.mp4` that is not clearly lighter than its master — spending crf
first, resolution second, because 540p at crf 26 still looks right on a phone at 3× DPR
where 404p visibly does not.

## Dense GOP is the cost model

`-g 8` at 24fps is a keyframe every third of a second. Normal web video is GOP 48–250. Seek
cost is dominated by frames-decoded-from-keyframe, so this is the single thing that makes a
scrub feel attached to the finger rather than mushy — and it roughly doubles the bitrate.

That trade is not an implementation detail, it *is* the format. A scroll-scrub page is
expensive because it is responsive to the finger. You cannot have both, and a page that
quietly picks GOP 48 to hit a byte target has shipped the cost without the benefit.

## AV1, and why it is not the default

AV1 would cut roughly 40–50% at equal quality, which on a 16 MB page is a real number. It is
still not the default, for two reasons:

1. **Seek cost, not file size, is the binding constraint here.** AV1 decode is materially
   more expensive per frame than H.264, and a dense-GOP scrub decodes constantly. On the
   low-end Android hardware that actually struggles, the bytes saved are paid back in
   dropped frames.
2. **Hardware AV1 decode is not universal.** Where it falls back to software, a scrub that
   held 60fps on H.264 will not.

The escape hatch, if you want it: encode an AV1 ladder *in addition*, serve it from a
`<source>` ahead of the H.264, and re-run `scroll-audit.mjs --mobile` on real hardware. If
the jank percentage holds, take the bytes. If it moves, you have your answer. Do not adopt
it on the file-size argument alone — that argument is true and insufficient.

## When you are over

In order of what costs least:

1. **Fewer scenes.** Four beats six. The format's weakness is length, not depth.
2. **Shorter dives.** 8s → 6s is a 25% cut across the whole chain.
3. **720p masters instead of 1080p.** Roughly halves everything. On a full-bleed
   background behind copy, far less visible than it sounds.
4. **Drop to tier 0 on phones.** Free, instant, and the posters are genuinely good.
5. **State the overage in the page spec and get it approved.** A 22 MB page shipped with
   the number written down is a decision. One shipped without is an accident.
