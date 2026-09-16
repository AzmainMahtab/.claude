Stack, architecture, and non-negotiables for every Astro site in this workspace. Imported by `CLAUDE.md`.

| Concern | Tool |
|---------|------|
| Framework | Astro 5 (static output by default) |
| Language | TypeScript, `strict`, `astro check` in the gate |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` — never the v3 PostCSS plugin, never a `tailwind.config.js` |
| Tokens | CSS custom properties in `@theme` — one source of truth, generated from the design guidelines |
| Content | Content collections (`src/content.config.ts`) + Zod schemas + MDX |
| Images | `astro:assets` (`<Image>` / `<Picture>`) — AVIF + WebP, never a raw `<img src>` for local art |
| Fonts | Self-hosted `@fontsource-variable/*`, `font-display: swap`, preloaded woff2 |
| Islands | Vanilla `<script>` first; a UI framework only when state genuinely demands it |
| Motion | The `motion` skill. `runtime/motion.css` animates reveals, staggers, wipes, scrubbed scenes and marquees with **0 bytes of JS**; its ~4KB runtime is for counters, text splitting, pointer response and parallax only |
| Forms | Astro Actions, or a form service — no Node server just to accept a POST |
| SEO | `@astrojs/sitemap`, `@astrojs/rss`, JSON-LD, per-page canonical + OG |
| Deploy | Static bundle on a CDN (Cloudflare Pages / Netlify) |
| Quality | `pnpm check` = `astro check` + `eslint` + `prettier --check` + `pnpm build` + Lighthouse CI |

Architecture: **Islands**. HTML is the default output; JavaScript is an explicit, justified exception. Layers:

```
src/
├── pages/          # routes only — compose sections, own <SEO>, own nothing else
├── layouts/        # Base.astro (html/head/body), page shells
├── components/
│   ├── primitives/ # Button, Heading, Container, Section, Prose — no business meaning
│   ├── sections/   # Hero, Stats, PricingGrid — one page band each, props in, no data fetching
│   └── islands/    # the only files allowed a client: directive
├── content/        # collections (blog/, projects/) — markdown + typed frontmatter
├── styles/         # global.css — @theme tokens, base layer, nothing else
└── lib/            # pure TS helpers, schema builders, formatters
```

Dependency rule: `pages/ → sections/ → primitives/`. A section never imports a page. A primitive never imports a section. Nothing in `components/` fetches data — pages pass props down.

## Non-negotiables

- **Zero JS is the default.** No `client:*` directive without a comment-free justification in the PR description. `client:load` is banned above the fold unless the element is non-functional without it.
- **Every image has explicit dimensions and a `sizes`.** Layout shift is a bug, not a polish item.
- **Every page scores 100/100/100/100** on Lighthouse mobile — Performance, Accessibility, Best Practices, SEO. The gate enforces it; a page that cannot hit it does not merge.
- **Tailwind utilities in the markup, tokens in `@theme`.** No `@apply` outside `primitives/`, no arbitrary values (`text-[13px]`) where a token exists, no inline `style=` for anything themeable.
- **Reusable or single-use is a decision, not an accident.** A pattern used twice becomes a component the second time, with typed `Props`.
- **Mobile-first.** Base styles are the 390px design; `sm:`/`md:`/`lg:` add, never subtract.
- **Real links.** Navigation is `<a href>`. A `div` with a click handler is not a link and costs the SEO score.

Authoritative detail: `skills/astro/SKILL.md` and its `references/`.

Use `/astro` (skill) for the build recipe, `/astro-coder` (agent) to implement, `/astro-page` (command) for a whole new page, `/astro-auditor` (agent) before declaring anything done.

Before finishing Astro work, run `pnpm check`. It is not optional and it includes the Lighthouse run.

Run the motion audit beside it: `node <motion-skill>/scripts/motion-audit.mjs <url>` and again with `--mobile`. It exits non-zero on a hero that animates at load, any layout-property animation or `transition: all`, a missing `prefers-reduced-motion` block, content left stuck at opacity 0, or a scroll that misses the frame budget. Lighthouse catches none of those.
