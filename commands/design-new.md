---
description: Design a new page or a whole project design system end to end — brief, reference research, tokens with a measured contrast table, canvas, and the two mandatory design documents.
argument-hint: <project> <page or "system"> [reference URLs]
---

# New Design — $ARGUMENTS

Load the `design` skill for the process and its three references. Use the `designer` agent to execute if this is more than a single section. Do not reproduce the templates here — they live in the skill.

## Phase 0 — Brief

Answer in the response. State assumptions rather than stalling; ask only where a wrong guess would waste the whole design.

- [ ] Who is this for, and what is the **one** primary action?
- [ ] Emotional register — restrained/editorial, warm/human, technical/dense?
- [ ] Real content inventory — actual sections, actual copy lengths. Not lorem ipsum.
- [ ] Reference set — URLs given, or the brand being extended.
- [ ] Does `<project>/.claude-project/design/DESIGN-GUIDELINES.md` already exist? If yes, you are **extending** it. Read it and stay inside it.

## Phase 1 — Research the references

- [ ] `WebFetch` each URL for structure: section order, hierarchy, heading text, image-to-text ratio, where the first CTA falls.
- [ ] Use the `pencil` `browser` tool to read real spacing, type and colour where the reference matters enough to measure.
- [ ] Extract decisions across structure / type / colour / space / detail / motion.
- [ ] Write the reference table: what was taken from where, and **why it fits this project**. Anything you cannot state as a decision with a reason was a vibe — drop it.
- [ ] Flag conflicts with the 100/100/100/100 target now (video hero, scroll animation, six weights, eager map embed) and propose the substitution.

## Phase 2 — System first

Write `DESIGN-GUIDELINES.md` before drawing a screen.

- [ ] Character — what this is, and what it deliberately is not.
- [ ] Colour: role-named tokens. One accent.
- [ ] **Contrast table — every shipping pair, measured.** Body ≥4.5:1, large text and UI ≥3:1. Compute; do not estimate. A failing pair does not enter the palette.
- [ ] Type: two families maximum, a modular scale as fluid `clamp()` values, with tracking and line-height per step.
- [ ] Space: 8pt base, fluid section padding and gutters, and the stated rhythm.
- [ ] Grid and breakpoints: 390 / 768 / 1440 minimum, container and gutter at each, plus where the grid is deliberately broken.
- [ ] Motion: durations, easing, what moves. Nothing animates the hero.
- [ ] Component policy: radius, borders, shadow, icons, imagery, focus, tap targets.
- [ ] Voice: headline limits, CTA wording, what is never said.

Set the same tokens as `.pen` document variables (`SetVariables`) so canvas and code share one vocabulary.

## Phase 3 — Name the components before drawing

- [ ] List every component the page needs. If it cannot be named, it should not be drawn.
- [ ] Build shared elements as real `.pen` components (`reusable: true`); instance them with `ref`. Never copy-paste a navbar or footer.
- [ ] Names describe role, not appearance.

## Phase 4 — Draw it

- [ ] `get_app_state` first. `placeholder: true` on the root frame for the duration.
- [ ] Flex layout, `fill_container` / `fit_content`. No hardcoded pixel widths on children.
- [ ] Real copy at real lengths — design around the **longest** plausible string.
- [ ] Decide the 390 behaviour for each section **as you draw it**, and record it immediately.
- [ ] Verify each section as you finish it with `Get` / `ctx.problems` — no clipping, no collapsed frames. Screenshot per finished section, not per edit.
- [ ] Clear `placeholder` when the frame is done.

## Phase 5 — Write the page spec

`pages/<page>.md` from the skill's template.

- [ ] Purpose and the single primary action.
- [ ] Section list with canvas node ids.
- [ ] **Component Inventory**: component, canvas node, code path, props, used on.
- [ ] Responsive table per section at 390 / 768 / 1440.
- [ ] Content limits and imagery brief with alt-text intent.
- [ ] Interaction table with the non-JS fallback for each.
- [ ] SEO intent: title, description, the one `h1`, heading outline, structured data.

## Phase 6 — Review

- [ ] Run the `design-reviewer` agent. Fix everything Critical and Major before handoff.
- [ ] Anti-slop pass: unjustified cards, repeated identical grids, centred-everything, more than one accent, uniform density.
- [ ] Update `<project>/.claude-project/status/`.

Handoff is the two documents plus the canvas node ids — that is what `astro-coder` builds from.
