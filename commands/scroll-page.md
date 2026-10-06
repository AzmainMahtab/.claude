---
description: Build a scroll-scrubbed cinematic page end to end — interview, budget approval, render chain, frame-locked seams, tiered encode, assembly and the audit gate.
argument-hint: <site> [scene count]
---

# Scroll page — $ARGUMENTS

Load the `scroll` skill. Use the `scroll-coder` agent to execute and `scroll-auditor` before
declaring it done. Do not reproduce recipes here — they are scripts in the skill's
`scripts/`.

**This command spends real money.** Nothing renders before Phase 1 is approved.

## Phase 0 — Orient

- [ ] `monid --version && monid balance`, `higgsfield workspace list`, `ffmpeg -version`
- [ ] Read `<site>/.claude-project/design/DESIGN-GUIDELINES.md` if it exists — palette, tone,
      type. If there is no design record, run `/design-new` first; a scroll page is a design
      artefact before it is a render job.
- [ ] Confirm the host: Astro route (default) or vanilla single-file (the scroll page *is*
      the site).

## Phase 1 — Interview and approve

- [ ] **Subject, asked openly in prose.** Never a fabricated multiple-choice list of
      industries.
- [ ] Brand kit — 4–6 named hex values, display name, tone.
- [ ] **Art direction — offer all six**, do not take the default silently:
      `node <skill>/scripts/intake.mjs --styles`. The choice becomes the style preamble,
      reused byte-for-byte in every scene prompt. `photoreal` changes the build.
- [ ] **Asset source** — `monid`/`higgsfield` present, or rendering by hand in another tool?
      A missing CLI is a different path, not a blocker.
- [ ] **Camera style** — always ask. "Fly through the world" → architecture B. "Continuous
      walkthrough" → A. "Locked isometric glide" → A + locked-iso clause.
- [ ] **Mobile tier**, asked next to the money: tier 1 is free and default, tier 2 roughly
      doubles the render spend.
- [ ] Scene count, then:

```bash
node <skill>/scripts/budget.mjs --estimate --scenes N --res 1080p
```

- [ ] **Show the user dollars AND megabytes. Get an explicit go-ahead.** Stop here until you
      have it.

## Phase 2 — Prompts to files, then stills

- [ ] Write the interview to `work/scenes.json`, then
      `node <skill>/scripts/intake.mjs --plan work --spec work/scenes.json`
- [ ] **Manual path:** hand over `work/WORKSHEET.md` — every row is one render with its
      prompt file, conditioning frame, filename and spec. Confirm their tool accepts a start
      frame (and an end frame for architecture B). Validate each batch with
      `intake.mjs --check`.
- [ ] **Automatic path:** stills all N concurrently, 3:2 ≥1536px, solid background, no text.
- [ ] Review for cohesion — same angle, palette, light. Re-roll off-style ones now; this is
      the cheapest place in the pipeline to fix the world.

## Phase 3 — Previz (skip only if the journey is settled)

- [ ] Whole chain on `seedance_2_0_mini` at 480p. ~$4 against ~$27 on an N=6.
- [ ] Confirm scene order and the seams with the user before the real spend.

## Phase 4 — Render

- [ ] Architecture B: dives in parallel. Architecture A: legs sequential, each from the
      previous leg's actual last frame, no `--end-image`.
- [ ] Detached, never a foreground blocking call. Re-roll individual failures.

## Phase 5 — Seams

- [ ] `bash <skill>/scripts/extract-frames.sh "$WORK"` — with bash, not zsh
- [ ] Connectors from the **extracted frames**, never the stills
- [ ] `node <skill>/scripts/seam-check.mjs "$WORK" --order …` — clean before encoding

## Phase 6 — Encode and budget

- [ ] `bash <skill>/scripts/encode.sh "$WORK" public/scroll`
- [ ] Tier 2 only if opted in: same script, `--portrait`, separate sources
- [ ] `node <skill>/scripts/budget.mjs public/scroll` — exits 0

## Phase 7 — Assemble

- [ ] Engine copied into the project; clips in `public/`, posters through `astro:assets`
- [ ] Exactly one `h1` — the engine only emits `h2`
- [ ] `og:image` set to a poster still, and it resolves
- [ ] A real `alt` on every scene

## Phase 8 — Gate

- [ ] `node <skill>/scripts/scroll-audit.mjs <url>`
- [ ] `node <skill>/scripts/scroll-audit.mjs <url> --mobile`
- [ ] `pnpm check` if Astro — a11y / best-practices / SEO at 100. Performance is exempt.
- [ ] `work/` is not in the deploy output
- [ ] Hand to `scroll-auditor` for the read-back

## Phase 9 — Record

- [ ] Page spec carries: architecture, mobile tier, dollar spend, measured payload, and the
      seam numbers. A redesign is a diff only if those exist.
- [ ] Update `<site>/.claude-project/status/`.
