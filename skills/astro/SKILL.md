---
name: astro
description: Use when building or changing any Astro site in this workspace — pages, sections, components, islands, content collections, images, fonts, SEO, or the performance gate. Covers the build order from design tokens up, the Tailwind v4 token contract, the islands rules, and the 100/100/100/100 Lighthouse gate.
---

# Astro Site Skill

Use this skill for any work inside an Astro site: a new page, a new section, a component refactor, a content collection, or a performance regression.

The premise of the whole stack: **HTML is the product, JavaScript is an exception you argue for.** Every rule below follows from that. Read `.claude/ASTRO.md` for the short version; this file is the procedure.

Two companion references live next to this file — read them instead of guessing:

- `references/performance-budget.md` — the exact playbook for scoring 100 on Performance, Accessibility, Best Practices and SEO. Category by category, with the code.
- `references/component-patterns.md` — worked source for every component shape this stack uses: primitives, sections, the SEO head, and the four island patterns.
- `references/content-collections.md` — blog and portfolio collections, typed frontmatter, RSS, and the JSON-LD that goes with them.

---

## Step 0 — Read the design record. Do not skip this.

```bash
ls <site>/.claude-project/design/
cat <site>/.claude-project/design/DESIGN-GUIDELINES.md
cat <site>/.claude-project/design/pages/<page>.md
```

`DESIGN-GUIDELINES.md` is the token source. `pages/<page>.md` is the section list, the Component Inventory, and the responsive behaviour at 390 / 768 / 1440.

**If either file is missing, stop and run the `design` skill first.** Building from a canvas screenshot produces pixel-matched components with no system behind them, and every later page pays for it. If the user insists on coding without a design doc, say what you are giving up and write the guidelines file yourself from whatever design exists before you write a component.

---

## Step 1 — Scaffold or orient

New site:

```bash
pnpm create astro@latest <site> -- --template minimal --typescript strict --no-git --install
cd <site>
pnpm add -D @tailwindcss/vite tailwindcss @astrojs/sitemap @astrojs/rss @astrojs/mdx sharp
pnpm add -D @lhci/cli prettier prettier-plugin-astro eslint eslint-plugin-astro
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  build: { inlineStylesheets: 'auto' },
  image: { formats: ['avif', 'webp'] },
  vite: { plugins: [tailwindcss()] },
});
```

`site` is not optional — the sitemap, canonical URLs and OG tags all derive from it, and three SEO audits fail without it.

Existing site: read `src/styles/global.css`, one page under `src/pages/`, and one section under `src/components/sections/` before writing anything. Match what is there.

---

## Step 2 — Tokens first: translate the guidelines into `@theme`

Every colour, size and family in `DESIGN-GUIDELINES.md` becomes a CSS custom property in `src/styles/global.css`. This file is the only place a raw hex code may appear.

```css
@import 'tailwindcss';

@theme {
  /* colour — names describe role, never appearance */
  --color-surface: #0b1733;
  --color-surface-raised: #132349;
  --color-ink: #f4f6fb;
  --color-ink-muted: #a8b4d0;
  --color-accent: #c9a227;
  --color-accent-ink: #0b1733;

  /* type — one display family, one text family, no more */
  --font-display: 'Fraunces Variable', Georgia, serif;
  --font-sans: 'Inter Variable', system-ui, sans-serif;

  /* fluid scale — clamp() replaces breakpoint-stepped font sizes entirely */
  --text-display: clamp(2.5rem, 1.2rem + 5.5vw, 5rem);
  --text-h2: clamp(1.75rem, 1.1rem + 2.6vw, 3rem);
  --text-body: clamp(1rem, 0.96rem + 0.2vw, 1.125rem);

  /* spacing rhythm — an 8pt scale, referenced by name */
  --spacing-section: clamp(4rem, 2rem + 8vw, 8rem);
  --spacing-gutter: clamp(1.25rem, 0.5rem + 3vw, 5rem);
}

@layer base {
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  body { background: var(--color-surface); color: var(--color-ink); font-family: var(--font-sans); }
  :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; }
}
```

Rules that hold for the life of the project:

- **No `tailwind.config.js`.** Tailwind v4 is configured in CSS. A config file in an Astro 5 project means someone pasted a v3 answer.
- **Fluid type via `clamp()`, not breakpoint-stepped `text-lg md:text-2xl lg:text-4xl`.** One token, every viewport, no jump at 768px.
- **Role names, not appearance names.** `--color-accent`, never `--color-gold`. The gold changes; the role does not.
- **Arbitrary values are a smell.** `text-[13px]` means the scale is missing a step. Add the step.

---

## Step 3 — Primitives (`src/components/primitives/`)

Small, unopinionated, no business meaning, fully typed. These are the only files allowed `@apply`.

```
Container.astro   max-width + gutter. Every section uses it. Nothing else sets horizontal padding.
Section.astro     vertical rhythm + optional surface tone + <section> landmark
Heading.astro     level (as) decoupled from size (size) — order the h1..h6 correctly, style freely
Button.astro      renders <a> when href is passed, <button> otherwise. Never a styled div.
Prose.astro       long-form markdown wrapper
```

`Heading` decoupling matters: heading order is an accessibility audit item, visual size is a design decision, and conflating them is how a page ends up with three `h1`s or a `h4` before a `h2`.

Full source for each: `references/component-patterns.md`.

---

## Step 4 — Sections (`src/components/sections/`)

One page band per file, named after the design's section: `Hero.astro`, `StatsStrip.astro`, `ServiceGrid.astro`, `CtaBanner.astro`.

- **Props in, markup out.** A section never calls `getCollection`, never reads `import.meta.env`, never fetches. The page does that and passes the result down.
- **Typed props, always:**

  ```ts
  interface Props {
    eyebrow?: string;
    title: string;
    items: readonly { title: string; body: string; icon: string }[];
  }
  const { eyebrow, title, items } = Astro.props;
  ```

- **A section reused on two pages takes props for what differs — it is not copied.** The Eventrra CTA banner and footer appear on all seven pages; they are one file each.
- **Slots for structural variation, props for content variation.** If a caller needs to replace a whole block, give it a named slot rather than a `variant` prop with five branches.
- **Mobile-first classes.** Base is the 390px design. `md:` and `lg:` add. If you find yourself writing `lg:block hidden`, you designed desktop-first — invert it.

---

## Step 5 — Assemble the page

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/sections/Hero.astro';
import StatsStrip from '../components/sections/StatsStrip.astro';
import { SERVICES } from '../lib/content/services';
---

<Base
  title="Eventrra — Event Design & Production"
  description="Full-service event management, decoration and floral design."
  image="/og/home.jpg"
>
  <Hero />
  <StatsStrip stats={STATS} />
</Base>
```

A page file is imports, data, and composition. If a page has more than a few lines of logic, that logic belongs in `src/lib/`.

`Base.astro` owns `<html lang>`, the head, canonical, OG, JSON-LD, the font preload, and the skip link. Nothing else touches `<head>`.

---

## Step 6 — Islands, last and grudgingly

Only now, once the page renders and works without JavaScript, add interactivity.

The ladder — take the highest rung that solves it:

1. **CSS only.** Accordion → `<details>/<summary>`. Modal → `<dialog>`. Carousel → scroll-snap. Tabs → `:target` or radio inputs. Hover/focus states → CSS. This is most of them.
2. **A `<script>` in the `.astro` file.** Scoped, bundled, tree-shaken, ~1KB. Progressive enhancement on top of working HTML: the tab panels are all visible without JS, the script hides all but one.
3. **A framework island.** Only for genuinely stateful UI — a multi-step form with cross-field validation, a live-filtered catalogue. `client:visible` or `client:idle`, never `client:load` above the fold.

```astro
<!-- correct: works with JS off, enhanced with JS on -->
<div data-tabs>
  <div role="tablist" aria-label="Project category">
    <button role="tab" aria-selected="true" aria-controls="p-all" id="t-all">All</button>
    <button role="tab" aria-selected="false" aria-controls="p-weddings" id="t-weddings">Weddings</button>
  </div>
  <div role="tabpanel" id="p-all" aria-labelledby="t-all"><slot name="all" /></div>
  <div role="tabpanel" id="p-weddings" aria-labelledby="t-weddings" hidden><slot name="weddings" /></div>
</div>

<script>
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panels = [...root.querySelectorAll('[role="tabpanel"]')];
    const select = (i: number) => {
      tabs.forEach((t, n) => t.setAttribute('aria-selected', String(n === i)));
      panels.forEach((p, n) => p.toggleAttribute('hidden', n !== i));
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (e) => {
        const k = (e as KeyboardEvent).key;
        if (k === 'ArrowRight') { const n = (i + 1) % tabs.length; tabs[n].focus(); select(n); }
        if (k === 'ArrowLeft') { const n = (i - 1 + tabs.length) % tabs.length; tabs[n].focus(); select(n); }
      });
    });
  });
</script>
```

Keyboard handling is not optional — a tablist without arrow keys fails the accessibility audit and, more to the point, does not work.

---

## Step 7 — Content collections for anything repeated

Blog posts, portfolio projects, team members, packages. Typed at build time, so a missing `coverImage` or a bad category fails the build instead of shipping broken. Full setup, RSS and JSON-LD: `references/content-collections.md`.

---

## Step 8 — The gate

```json
{
  "scripts": {
    "check": "astro check && prettier --check . && eslint . && astro build && lhci autorun",
    "check:fast": "astro check && astro build"
  }
}
```

`lighthouserc.json`:

```json
{
  "ci": {
    "collect": { "staticDistDir": "./dist", "numberOfRuns": 3, "settings": { "preset": "desktop" } },
    "assert": {
      "assertions": {
        "categories:performance":    ["error", { "minScore": 1 }],
        "categories:accessibility":  ["error", { "minScore": 1 }],
        "categories:best-practices": ["error", { "minScore": 1 }],
        "categories:seo":            ["error", { "minScore": 1 }]
      }
    }
  }
}
```

Run mobile too — it is the harder target and the one PageSpeed Insights shows first. Drop `settings.preset` for the mobile pass.

**`pnpm check` passing is the definition of done.** Not "it looks right", not "the build succeeded". If a score is below 100, `references/performance-budget.md` names the fix for every audit that commonly costs points; work it top down rather than guessing.

---

## Review checklist

Before handing anything back:

- [ ] Every section in the page spec exists, and every component in the Inventory table is at the path the table claims.
- [ ] The page renders and is fully readable with JavaScript disabled.
- [ ] Checked at 390, 768 and 1440 — matches the design spec's stated behaviour at each.
- [ ] Every image has width, height, `sizes`, and correct `loading` / `fetchpriority`.
- [ ] Exactly one `h1`; heading levels descend without gaps.
- [ ] Tab through the page: focus is always visible and the order is the reading order.
- [ ] No raw hex outside `global.css`; no arbitrary Tailwind values where a token exists.
- [ ] `pnpm check` green, all four categories at 100.
