---
name: scroll
description: Use when building a scroll-scrubbed cinematic landing page — a "fly through the world" hero, a diorama world, a browse-through-the-industry scroll, or any page where scroll drives a camera through pre-rendered video instead of triggering cuts. Covers the interview, AI render pipeline (Monid/Higgsfield/Codex/manual), the frame-locked seam method, a three-tier mobile model where phone video is opt-in, encode and payload budgets, the Astro integration, and scripts that fail a build on the defects reviews miss.
---

# Scroll

A page where **scroll drives a camera**: it dives from outside a scene into its interior,
flies out and into the next, continuously, with no visible cuts. Scroll only moves time
along a single pre-rendered camera path. Same technique as Apple's scroll-through product
pages.

Derived from **lets-scroll** (MIT, cyw — `github.com/AzmainMahtab/lets-scroll`). The seam
method, camera grammar, model roster, prompt templates and provider gotchas are upstream's
empirical work. What is different here: mobile video is a three-tier opt-in, every recipe is
an executable script, payload is budgeted next to spend, and the page ships a real head and
a real accessibility contract.

## What ships

| File | What it is |
|---|---|
| `runtime/scrub-engine.js` | The engine. Vanilla, zero deps, builds its own DOM and CSS. Three mobile tiers, streaming-first with blob fallback, memory ceiling, reduced-motion path, iOS priming, seek coalescing. |
| `scripts/intake.mjs` | **The no-subscription path.** Turns the interview into every prompt as a file plus a render worksheet, then validates whatever you drop back in. |
| `scripts/placeholder.mjs` | **Stamped stand-in media**, so the page can be assembled and audited while renders are pending. Everything it writes fails the ship gates by design. |
| `scripts/lib/provenance.mjs` | The marker, the stamper, the detector. One string, three consumers. |
| `scripts/encode.sh` | Desktop master + the free tier-1 phone variant in one pass, ffprobe-verified. |
| `scripts/extract-frames.sh` | Seam boundary frames + the connector spec table. |
| `scripts/seam-check.mjs` | Verifies every seam by PSNR. Replaces the eyeball pass. |
| `scripts/budget.mjs` | Payload estimate before you spend; payload gate after you encode. |
| `scripts/scroll-audit.mjs` | The build gate. Payload at the wire, tier contract, reduced motion, focus, head, memory. Exits non-zero. |
| `scripts/test-engine.mjs` | 32 assertions over the engine. Run after any change to it. |
| `scripts/test-placeholder.mjs` | 14 assertions over the provenance chain — chiefly that the stamp survives `encode.sh`. |
| `scripts/knockout.py` | Border-connected background knockout, for floating scenes. |
| `references/` | `budget.md`, `seams.md`, `backends.md`, `pipeline.md`, `prompts.md`, `astro.md` |
| `demo/index.html` | Three-scene fixture. `npm test` synthesises its clips. |

## The one rule

**Seams must be frame-identical.** A connector's endpoints are the ACTUAL RENDERED FRAMES of
its neighbours, never the original still. Read `seams.md` before generating any connector.
Getting this wrong is the most common failure and produces a visible pop.

## The three mobile tiers

A tier-1 phone clip is a pure ffmpeg **re-encode** of the desktop master. It costs $0 and no
extra generation. Only the native 9:16 portrait chain costs money. Upstream conflates the
two behind one opt-in, which is how builds end up serving desktop masters to phones.

| Tier | Phone gets | Render cost | Default |
|---|---|---|---|
| 0 `stills` | WebP posters, cross-dissolving. Zero video bytes. | $0 | Forced under reduced-motion and Save-Data |
| 1 `light` | 540–720p `-g 4` re-encode of the master | **$0** | **Yes** |
| 2 `portrait` | Native 9:16 render | **+2N−1 generations** | Explicit opt-in |

Responsive **layout** is always on. Only the video is tiered. And the fallback direction is
the point: a missing tier file means a phone gets **stills**, never the heavy master.

## Build order

### 0 — Orient

Check `monid --version && monid balance`, `higgsfield workspace list`, `ffmpeg -version`.
Details and fallbacks in `backends.md`.

### 1 — Interview

Ask the **subject as an open question in plain prose** — never a fabricated multiple-choice.
A made-up list of industries biases the answer and reads as deciding someone's business for
them. "What should this world be about? Your business, a client's, or any idea — a word or a
sentence is fine."

Reserve structured choice for the genuinely enumerable, and signal they can go their own way:

1. **Subject** (open) — industry/product, one-line pitch, brand name if they have one.
2. **Brand kit** — import from a URL, take theirs directly, or propose and get approval.
   Capture 4–6 named hex values, a display name, a tone word or two.
3. **Art direction — always offer the alternatives, never just take the default.** This is
   the single biggest lever on whether the page looks like anything. Ask with
   `AskUserQuestion`; the choice becomes the **style preamble**, reused byte-for-byte in
   every scene prompt, and that identical text is what makes the world cohere.

   | | |
   |---|---|
   | `clay` | Soft matte low-poly clay diorama, isometric, tilt-shift miniature, warm light. **Default.** |
   | `papercraft` | Layered paper-craft, matte cardstock, clean die-cut edges |
   | `toy` | Glossy vinyl toy, smooth plastic shading, collectible figurine |
   | `claymation` | Stop-motion clay, visible thumbprints, handmade plasticine |
   | `neon` | Night miniature, warm interior glow, neon signage, wet reflective ground |
   | `photoreal` | Photoreal architectural — real estate, hospitality, luxury. **Changes the build:** full-bleed not floating, no knockout, dark page background, the dive glides *through* doorways rather than opening a roof, and never pass a reference image (it clones the room) |

   `node scripts/intake.mjs --styles` prints this. Full text of every preamble, plus the
   shared palette/no-text tail, is in `prompts.md`.
4. **Camera style — always ask.** It is the film's personality, not a technical detail.
   "Fly through the world" → architecture B. "One continuous walkthrough" → A. "Locked
   isometric glide" → A with the locked-iso clause. `seams.md` implements the choice; it
   never re-decides it.
5. **Asset source** — do they have the render CLIs, or are they rendering by hand?
   `monid`/`higgsfield` present → the automatic path. Absent, or they prefer their own
   tools (Kling, Runway, Sora, Midjourney, a web UI with no API) → **the manual path
   below**. Ask; do not assume, and do not let a missing CLI end the conversation.
6. **Mobile tier** — with the dollar delta stated. Tier 1 is free and on by default; tier 2
   roughly doubles the render spend. This is a budget question, so ask it next to the money.
7. **Scene count** — then immediately:

```bash
node scripts/budget.mjs --estimate --scenes N --res 1080p
```

**Do not skip that.** It prints the payload being committed to, beside the spend. A 1080p
N=6 chain is about $27 and about 33 MB. Both numbers get approved here or nowhere.

### 2 — Write every prompt to a file

**Always, on both paths.** The prompt files are what the automatic path `cat`s into the CLI
and what the manual path hands the user. They are also the only record of how the world was
described, which is what makes a re-roll six weeks later a diff instead of a guess.

Write the interview into `work/scenes.json` — brand, style, bg, palette, arch, and one entry
per scene with its `subject` and `focal` — then:

```bash
node scripts/intake.mjs --plan work --spec work/scenes.json
```

That writes `still_<id>.txt`, `dive_<id>.txt` (or `leg_<id>.txt` for architecture A),
`conn_<i>.txt`, and `WORKSHEET.md` — the full render order with every conditioning frame,
output filename and a status column. Templates live in `prompts.md`; the script fills them
with the chosen style preamble so the text really is byte-identical across all N.

### 2.5 — Scaffold, optionally

Assembling before the renders exist is a real option on the manual path, where the clips
arrive in someone else's tool on someone else's schedule:

```bash
node scripts/placeholder.mjs --spec work/scenes.json --out work/placeholder
bash scripts/encode.sh work/placeholder public/scroll
```

Be honest about the trade. It **does** let you finish and verify everything that does not
depend on footage — engine wiring, theming, the head, the accessibility contract, the tier
contract, layering. That is not a small half, and it is where defects like a 1.13:1 button
on a dark ground actually live.

It validates **nothing** about seams, real payload, or whether the copy is legible over real
footage. `budget.mjs` reporting 3.8 MB of gradients is not a payload result, and Performance
100 against a 50 KB clip is not a Performance result. Say so when reporting, or the green
ticks lie.

Every file it writes is stamped `SCROLL_PLACEHOLDER_V1` inside its own bytes. `budget.mjs`
fails on it locally, `scroll-audit.mjs` fails on it at the wire, and the stamp leaves when
the file is replaced — there is no flag to unset. Skip this step entirely if the renders are
already in hand.

### 3 — Render

**Automatic path** — `backends.md` for models and billing, `pipeline.md` for the batch
commands. Stills first, all N concurrently; review for cohesion before continuing. This is
the cheapest place to fix the world and a very expensive one two steps later.

**Manual path — no CLI, no subscription, any tool.** Hand the user `WORKSHEET.md`. They
render each row in whatever they like — Kling, Runway, Sora, Midjourney, a web UI with no
API at all — and save results into `work/` under the exact filenames in the *Save as*
column. Two rules to state up front:

- Their tool **must accept a start frame**. Architecture B connectors also need an **end**
  frame; if the tool has no end-frame input, switch to architecture A rather than shipping
  unseamed joins.
- Renders are **not** all parallel. Architecture B: dives can go at once, connectors only
  after the dives exist. Architecture A: strictly sequential, every leg conditioned on the
  previous leg's extracted last frame.

As each batch lands:

```bash
node scripts/intake.mjs --check work --spec work/scenes.json
```

It checks every file decodes, aspect, duration, audio, and — where the conditioning frame
came from this pipeline — that **frame 0 actually matches it**. A tool that silently ignored
your start image fails here, which costs one re-render instead of poisoning every clip after
it. Where the conditioning frame is a 3:2 still and the clip is 16:9, it reports the number
and the geometry instead of failing, because a renderer is free to letterbox and PSNR cannot
settle a reframe.

Architecture and camera grammar either way: `seams.md`.

On the automatic path, run the whole chain on `seedance_2_0_mini` at 480p first — roughly $4
instead of $27 on an N=6 — to validate the journey and the seams before the real spend. It
keeps frame-locking, so structure translates directly. On the manual path the same logic
applies: render every clip at your tool's cheapest setting first and look at the sequence
before paying for quality.

### 4 — Extract and connect

```bash
bash scripts/extract-frames.sh "$WORK"
```

Prints the connector spec table. Run it with **bash**, not zsh.

### 5 — Verify the seams

```bash
node scripts/seam-check.mjs "$WORK" --order a,b,c
```

Two PSNR readings per seam — detail and composition — because one number confuses "soft"
with "wrong". Fix every FAIL here.

### 6 — Encode

```bash
bash scripts/encode.sh "$WORK" public/scroll
```

Desktop master and the free tier-1 variant, ffprobe-verified, with the size delta reported.
Tier 2 is a separate pass with `--portrait`.

### 7 — Budget

```bash
node scripts/budget.mjs public/scroll
```

Non-zero over the ceilings. `budget.md` lists what to cut, cheapest first.

### 8 — Assemble

Astro is the default host — `astro.md`. Vanilla single-file is the documented fallback when
the scroll page is the whole site.

Three things the page owns that the engine does not:

- **Exactly one `h1`.** The engine emits `h2` per scene and nothing above it.
- **`og:image`.** You have rendered four to six cinematic stills; one of them is the link
  preview. A scroll page exists to be shared.
- **A real `alt` per scene.** Under reduced motion the stills *are* the page. The engine
  warns when one is missing and the accessible mirror loses that scene.

### 9 — Ship

**Ships:** the built output, the engine, `public/scroll/*.mp4`, the poster WebPs, favicon.
**Does not:** `work/` — prompts, raw renders, extracted PNGs, JSON responses. It is usually
larger than the site.

```bash
node scripts/scroll-audit.mjs <url>
node scripts/scroll-audit.mjs <url> --mobile
```

Both exit 0, or it is not done.

## Definition of done

- [ ] `seam-check.mjs` clean
- [ ] `budget.mjs` clean on the shipped directory
- [ ] `scroll-audit.mjs` clean on desktop **and** `--mobile`
- [ ] `pnpm check` green if Astro — a11y, best-practices and SEO asserted at 100
- [ ] `work/` is not in the deploy output
- [ ] no placeholder media in the shipped output — `budget.mjs` and `scroll-audit.mjs` both assert this
- [ ] The page spec records the tier chosen, the dollar spend, and the measured payload

Performance 100 is **not** on that list. A scroll-scrub route cannot reach it and is
formally exempt — see `.claude/ASTRO.md`. `scroll-audit.mjs` replaces that assertion with
ones Lighthouse cannot make.

## Gotchas

Provider-specific ones live in `backends.md`. These are the ones that bite here:

- **Placeholder media reaching production.** A scaffold build is bytes-correct and
  wiring-correct while the footage is synthetic, so every ordinary gate stays green. The
  marker is embedded in the media rather than kept in a sidecar manifest for exactly this
  reason: a manifest can be deleted while the files stay, but an embedded stamp can only
  disappear by replacing the file — which is the action that makes shipping safe.
- **A phone served the desktop master.** The commonest defect in this format, and invisible
  on a laptop. `scroll-audit.mjs --mobile` fails on it.
- **A "mobile" encode bigger than its master.** Halving the GOP costs 25–40% more bitrate,
  so a `-g 4` re-encode at the master's own resolution is *heavier*. The resolution step is
  what pays for the keyframes. `encode.sh` measures and refuses.
- **ffmpeg eating stdin.** Any `while read` loop calling ffmpeg needs `-nostdin`, or ffmpeg
  consumes the loop's input and the next iteration gets a truncated path.
- **PSNR on stderr.** ffmpeg writes filter results to stderr; `execFileSync` returns stdout
  only, so a naive wrapper silently reports "no PSNR" for every seam.
- **zsh is 1-indexed.** Every array-driven chain step goes in a `#!/bin/bash` script.
- **Focus in invisible copy.** A link at `opacity: 0` is still in the tab order. The engine
  sets `inert`; keep that if you port it.
- **Blank scene on iOS.** A muted video that was never played will not paint a seeked frame.
  The engine keeps the still as a live poster and primes on first touch — do not hide the
  still on `loadedmetadata` or strip `playsinline`/`muted` if you adapt it.
- **Page jumps on mobile scroll.** The URL bar firing `resize`. The engine ignores
  height-only resizes on touch; gate any ported resize handler on a width change.

## Changing the engine

```bash
npm install && npm test
```

`npm test` runs both suites. 32 assertions covering tier selection, the stills and reduced-motion paths fetching nothing,
the memory ceiling, focus containment, and the blob fallback on a range-less host. The tier
contract and the reduced-motion path are exactly the things that regress silently and cost
real money on someone's phone.
