# Seams, architecture and camera grammar

<!-- The seam law, the two architectures, the motion-handoff contract and the mid-leg
     move table are ported from lets-scroll (MIT, cyw — github.com/AzmainMahtab/lets-scroll).
     They are the product of real renders and real failures; nothing here is theory.
     What is new: the seam check is a script, not an eyeball. -->

Getting this wrong is the single most common failure and produces a visible "pop" between
scenes. Read this before generating any connector.

## The law

**A connector's endpoints must be the ACTUAL RENDERED FRAMES of its neighbouring clips,
never the original diorama still.**

Every generation renders slightly differently. If a connector *ends* on a fresh render of
"the kitchen diorama", and the next dive *starts* on its own different render of that same
diorama, the two will not match and you get a pop.

```
For each connector between dive_i and dive_{i+1}:
  start-image = the LAST frame extracted from dive_i's rendered video
  end-image   = the FIRST frame extracted from dive_{i+1}'s rendered video
```

Then `dive_i.end == connector.start` and `connector.end == dive_{i+1}.start`, and every
seam is frame-identical on both sides.

`bash scripts/extract-frames.sh <workdir>` does the extraction and prints the connector spec
table. Run it with **bash**, never zsh — zsh arrays are 1-indexed and an array-driven chain
loop there silently grabs the wrong scene's frames.

## Verifying, without eyeballing

```bash
node scripts/seam-check.mjs <workdir> [--order a,b,c] [--arch a]
```

It takes two PSNR readings per seam, because one cannot decide this. Upstream's own note is
correct: a properly frame-locked seam still reads ~18–25 dB at full resolution from detail
shimmer alone, so a single number confuses "soft" with "wrong". So:

- **detail** — PSNR at full resolution
- **composition** — PSNR at 32×32, which ignores detail entirely

| detail | composition | verdict |
|---|---|---|
| low | high | fine — the normal case for an end-image |
| low | **low** | **FAIL** — different renders, re-extract and re-render |
| high | high | perfect frame lock |

Thresholds: a start-image must be obeyed exactly (≥28 dB); an end-image only needs the same
composition (≥18 dB detail, ≥26 dB composition). Measured on a known-good build: start seams
39–40 dB, end seams 27–29 dB. On a deliberately mismatched chain: 8–16 dB on both. The
threshold sits in clean air between them.

## Two architectures

### A — continuous forward take
**Recommended for grounded, realistic and walkthrough directions.**

One camera that only ever glides forward, first scene to last, as a single take. Legs render
**sequentially**: leg 0 from scene 0's still; each subsequent leg's `--start-image` is the
previous leg's **actual last frame**; prompt *"continue gliding smoothly FORWARD into
[scene i], never pulling back"*; and **no `--end-image`** — an end-image of a wide
establishing shot forces the camera to pull back, which is the number one cause of stutter.

There are no connectors. The legs *are* the journey. Wire with `connectors: []` and a small
`crossfade` (~0.08).

Cost: strictly sequential, so it cannot be parallelised. Interiors trip content filters, so
budget three attempts per leg.

### B — dive-in + aerial connector
**Only for diorama, miniature and god's-eye worlds.**

A dive into each scene, plus a connector that pulls up and out and flies to the next. The
pull-out **reverses camera direction at every seam**. In a miniature world that reads as an
intentional "zoom out to the map, fly to the next island". In a grounded first-person
walkthrough it reads as a jarring rewind.

`seam-check.mjs` warns about this on every architecture-B build. The warning is not noise —
it is the one thing about B that a frame-perfect seam cannot fix.

## Camera grammar — A is not "forward only"

"Forward only" is the **seam** rule, not the **leg** rule.

- **Position continuity** at a seam comes from the frame handoff.
- **Velocity continuity** means the camera must never *reverse across a seam*.
- **Inside a single leg the camera is free.** One leg is one continuous render — there is no
  seam to break mid-leg, so orbits, crane-ups, lateral tracking and push-ins that ease back
  out are all safe *within* the clip.

So give each leg an expressive move from the scene's own logic, under a **motion handoff
contract**: every leg ends by settling into a slow steady forward drift toward the next
destination (final ~1s), and every leg begins by continuing that same drift. Both clauses go
in the prompts verbatim — templates in `prompts.md`.

| Concept / tone | Mid-leg move |
|---|---|
| Product / luxury retail | slow half-orbit around the hero object, then continue past it |
| Real estate / hospitality | steadicam glide through doorways; gentle crane-up in atria |
| Industrial / process / logistics | low lateral track alongside the line, foreground parallax |
| Travel / outdoors / campus | drone-style rise-and-reveal, then a descending swoop |
| Food / craft / detail-driven | push in close to the craft moment, ease back, carry on |
| Playful miniature (arch. B) | dives + aerial hops — the connector *is* the grammar |

**Locked-iso variant:** architecture A where every leg pins the view instead of taking a
mid-leg move. Calmest look, cheapest re-rolls. Models drift the angle slightly on long legs —
eyeball each leg's last frame and re-roll one whose view has rotated.

Honest cost: expressive moves raise re-roll odds, because a model can end a fancy move in a
state that is not a clean forward drift. Keep the final-second settle clause verbatim, check
each leg's last frame before chaining the next, and budget one extra re-roll per expressive
leg. A plain forward glide stays the zero-risk default.

## Scroll runs backwards too

Visitors scroll up. Every move also plays in reverse — free and expected, but it is another
reason seam velocity must be consistent in both directions. A seam that reads fine forward
reads as a stutter backward too if velocity flips.

## Pacing lives in the engine, not the render

Two knobs, per section:

- `scroll` — viewport-heights of scroll for this scene. More distance = longer dwell.
- `linger` (0–1, keep ≤0.6) — remaps time so the camera settles mid-scene, exactly where the
  copy peaks, then picks up toward the seam. `f(0)=0, f(1)=1`, so seam frames are untouched.

Prefer expressive motion in the *clip* and restraint in the *scrub mapping*. They compound.
