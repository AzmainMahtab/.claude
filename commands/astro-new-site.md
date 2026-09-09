---
description: Scaffold a new Astro site in this workspace — dependencies, config, token stylesheet, primitives, layout, records directory, and the Lighthouse gate — before any page is built.
argument-hint: <site-directory> <production URL>
---

# New Astro Site — $ARGUMENTS

Load the `astro` skill. This creates the shell only; pages come after, via `/astro-page`.

## Phase 1 — Scaffold

```bash
pnpm create astro@latest <site> -- --template minimal --typescript strict --no-git --install
cd <site>
pnpm add -D @tailwindcss/vite tailwindcss @astrojs/sitemap @astrojs/rss @astrojs/mdx sharp
pnpm add -D @lhci/cli prettier prettier-plugin-astro eslint eslint-plugin-astro
```

- [ ] `astro.config.mjs`: `site` set to the real production URL (the sitemap, canonicals and OG tags all derive from it — three SEO audits fail without it), `output: 'static'`, `mdx()` + `sitemap()`, `prefetch`, `build.inlineStylesheets: 'auto'`, `image.formats: ['avif','webp']`, and `tailwindcss()` in `vite.plugins`.
- [ ] **No `tailwind.config.js`.** v4 is configured in CSS.

## Phase 2 — Records

- [ ] `<site>/.claude-project/{design/pages,docs,memory,status,plan}/`
- [ ] `<site>/AGENTS.md` pointing at `.claude-project/` so non-Claude harnesses find it.
- [ ] If a design already exists, move or write `DESIGN-GUIDELINES.md` into `.claude-project/design/` now — it is the input to the next phase.

## Phase 3 — Tokens

- [ ] `src/styles/global.css`: `@import 'tailwindcss'`, then `@theme` with the colour, type, spacing and radius tokens from the guidelines, then a base layer with the focus ring, `prefers-reduced-motion` collapse and body defaults.
- [ ] Fonts: `@fontsource-variable/*`, latin subset, `font-display: swap`, a `size-adjust` metric-matched fallback face, and a preload for the above-the-fold face only. Prefer the stable `astro:fonts` API if the installed version has it — check, do not assume.

## Phase 4 — Shell

- [ ] `src/components/primitives/`: `Container`, `Section`, `Heading`, `Button`.
- [ ] `src/layouts/Base.astro`: the only file that touches `<head>` — title, description, canonical, OG, Twitter, JSON-LD slot, sitemap and RSS links, skip link, `<main>`.
- [ ] `public/robots.txt` with the sitemap URL. `public/og/default.jpg` at 1200×630 — and make sure it actually exists; a 404 on `og:image` is invisible locally and obvious in a link preview.
- [ ] A site-wide `Organization` or `LocalBusiness` JSON-LD block.

## Phase 5 — Gate

- [ ] `lighthouserc.json` asserting all four categories at `minScore: 1`, collecting from `./dist`.
- [ ] `"check": "astro check && prettier --check . && eslint . && astro build && lhci autorun"` in `package.json`.
- [ ] Run it on the empty shell. It must be green **before** the first page is written — a gate that has never passed is not a gate, and debugging it against a finished page mixes shell problems with page problems.

## Phase 6 — Prove it

- [ ] `pnpm build && pnpm preview`, load the shell, confirm: no console errors, zero client JS, fonts loading from the same origin, `view-source` shows real HTML.
- [ ] Then `/astro-page <site> <first page>`.
