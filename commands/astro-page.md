---
description: Build one Astro page from its design spec, from tokens through sections to the 100/100/100/100 gate.
argument-hint: <site> <page name>
---

# Build Page — $ARGUMENTS

Load the `astro` skill and its references. Use the `astro-coder` agent to execute. Do not reproduce the code templates here — they are in `references/component-patterns.md`.

## Phase 0 — Read the design record

- [ ] `<site>/.claude-project/design/DESIGN-GUIDELINES.md` — the token source.
- [ ] `<site>/.claude-project/design/pages/<page>.md` — section list, Component Inventory, responsive table, content limits, interaction fallbacks, SEO intent.

**If either is missing, stop and run `/design-new` first.** Building from a screenshot produces pixel-matched components with no system behind them, and every later page pays for it.

- [ ] If the site already exists, read `src/styles/global.css`, one page and one section. Match what is there rather than adding a second way to do the same thing.

## Phase 1 — Tokens

- [ ] Every colour, family, size and spacing value from the guidelines into `@theme` in `src/styles/global.css`. This is the only file where a raw hex may appear.
- [ ] Fluid type as `clamp()` tokens — not `text-lg md:text-2xl lg:text-4xl`.
- [ ] Base layer: focus-visible ring, `prefers-reduced-motion`, body defaults.
- [ ] No `tailwind.config.js`. Tailwind v4 is configured in CSS.

## Phase 2 — Primitives and shell

- [ ] `Container`, `Section`, `Heading` (level and size decoupled), `Button` (renders `<a>` when given `href`). These are the only files allowed `@apply`.
- [ ] `Base.astro` — the only file that touches `<head>`: title, description, canonical, OG, Twitter, JSON-LD, font preload, skip link, `<main>`.
- [ ] Self-hosted variable fonts, subset, with a `size-adjust` metric-matched fallback.

## Phase 3 — Sections

In the page spec's order, at the Inventory's paths.

- [ ] `interface Props` on every one. No data fetching inside a section.
- [ ] Mobile-first classes — base is 390, `md:`/`lg:` add.
- [ ] Images through `astro:assets` with `widths` + `sizes`, aspect-ratio-locked wrappers, `loading="lazy"` — except the one LCP image, which gets `eager` + `fetchpriority="high"` and no entrance animation.
- [ ] A section reused across pages is one file taking props, never a copy.

## Phase 4 — Assemble

- [ ] The page file is imports, data, composition. Logic goes to `src/lib/`.
- [ ] Content collections if the page repeats a shape — typed frontmatter, `coverAlt` required in the schema.
- [ ] Category filtering as real routes with `aria-current`, not a client-side filter, unless the design genuinely needs multi-facet filtering.

## Phase 5 — Interactivity, last

Only after the page works without JavaScript.

- [ ] CSS first: `<details>`, `<dialog>`, scroll-snap.
- [ ] Then a scoped `<script>` enhancing working markup.
- [ ] A framework island only for genuinely stateful UI — `client:visible` or `client:idle`, never `client:load` above the fold.
- [ ] Keyboard handling on anything custom: arrow keys on a tablist, Escape on a dialog.
- [ ] `grep -rn "client:" src/` — every directive justified.

## Phase 6 — Gate

- [ ] `pnpm check` — `astro check` + lint + format + build + `lhci autorun`, all four categories asserted at 1.0.
- [ ] Run mobile as well as desktop. Mobile is the harder target and what PageSpeed Insights shows first.
- [ ] Below 100? Read the failing audit and fix the cause — `references/performance-budget.md` names it. Do not guess.
- [ ] JavaScript disabled: the page still reads and navigates.
- [ ] 390 / 768 / 1440 match the spec's stated behaviour.
- [ ] Tab through: focus always visible, order is reading order.
- [ ] `astro build` client bundle is what you expect — 0 bytes for a plain marketing page.

## Phase 7 — Close out

- [ ] Run `astro-auditor` if any score was ambiguous or an island was added.
- [ ] Mark the page spec's Status as Built; note any recorded substitution (real routes instead of a JS filter, static map for an embed).
- [ ] Update `<site>/.claude-project/status/`.

Report the four scores honestly. A page shipped at 94 with the reason stated is useful; one reported as 100 that is not is worse than useless.
