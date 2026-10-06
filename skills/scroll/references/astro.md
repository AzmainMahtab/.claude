# Astro integration

The scrub engine is the page's entire JavaScript budget, so the right host is the framework
that ships nothing of its own. Astro also closes four of this skill's gaps for free: a
bundled `<script>` is minified, `astro:assets` gives the posters AVIF+WebP with explicit
dimensions, `Base.astro` already owns the head, and `@astrojs/sitemap` already exists.

Read `.claude/ASTRO.md` and the `astro` skill first — everything there still applies. This
file is only what is different about a scroll-scrub route.

## Where the pieces live

```
src/
├── pages/
│   └── index.astro              # owns <SEO>, the h1, and the scene data
├── layouts/
│   └── Base.astro               # head: canonical, OG, JSON-LD — already yours
├── components/sections/
│   └── ScrollWorld.astro        # the mount point + the <script>
├── lib/
│   └── scenes.ts                # typed scene data, one export
└── styles/global.css            # @theme tokens; the engine reads --sw-* from here
public/
└── scroll/
    ├── s1.mp4  s1-m.mp4  …      # clips — public/, NOT src/
    └── conn1.mp4  conn1-m.mp4 …
```

**Clips go in `public/`, not `src/`.** Astro would otherwise try to process them through the
asset pipeline, which it has no reason to do for video and which breaks the byte-range
serving the streaming path depends on. Posters are the opposite: they go through
`astro:assets` so you get AVIF/WebP and no layout shift.

## The section component

```astro
---
// src/components/sections/ScrollWorld.astro
import { getImage } from 'astro:assets';
import type { Scene } from '../../lib/scenes';

interface Props {
  scenes: Scene[];
  brand: { name: string; href?: string };
  cta?: { label: string; href: string };
  mobileTier?: 'stills' | 'light' | 'portrait';
}
const { scenes, brand, cta, mobileTier = 'light' } = Astro.props;

// Posters through the pipeline: WebP, explicit dimensions, no CLS.
const posters = await Promise.all(
  scenes.map((s) => getImage({ src: s.poster, format: 'webp', width: 1280 }))
);

const config = {
  brand, cta, mobileTier,
  hint: 'scroll to fly in',
  diveScroll: 1.3,
  connScroll: 0.9,
  sections: scenes.map((s, i) => ({
    id: s.id, label: s.label,
    still: posters[i].src,
    clip: `/scroll/${s.id}.mp4`,
    clipMobile: `/scroll/${s.id}-m.mp4`,
    ...(s.portrait ? { clipPortrait: `/scroll/${s.id}-p.mp4` } : {}),
    alt: s.alt,
    accent: s.accent, scroll: s.scroll, linger: s.linger,
    eyebrow: s.eyebrow, title: s.title, body: s.body, tags: s.tags,
    ...(s.cta ? { cta: s.cta } : {}),
  })),
  connectors: scenes.slice(0, -1).map((_, i) => `/scroll/conn${i + 1}.mp4`),
  connectorsMobile: scenes.slice(0, -1).map((_, i) => `/scroll/conn${i + 1}-m.mp4`),
};
---

<div id="world"></div>

<script is:inline define:vars={{ config }}>window.__scrollConfig = config;</script>
<script>
  // Bundled and minified by Astro. This is the route's entire client payload.
  import '../../../.claude/skills/scroll/runtime/scrub-engine.js';
  mountScroll(document.getElementById('world'), window.__scrollConfig);
</script>
```

Copy `scrub-engine.js` into `src/lib/` in a real project rather than importing across the
skill boundary — the import path above is illustrative.

## The head

`Base.astro` already owns this; the scroll route only has to pass it the right things. The
audit fails without them.

```astro
<SEO
  title={`${brand} — ${pitch}`}
  description={description}
  canonical={Astro.site && new URL(Astro.url.pathname, Astro.site).href}
  image={ogPoster.src}          {/* scene 1's poster — already rendered, costs nothing */}
/>
```

The `og:image` is the single most under-used asset in this format. You have generated four
to six cinematic stills. One of them is your link preview. The audit fails a route with no
`og:image` and fails again if it 404s.

## The h1

The engine emits `h2` per scene and nothing above it. **The page must own exactly one
`h1`** — the audit fails otherwise. Usually it is visually hidden, because the design's
opening statement is the first scene's copy:

```astro
<h1 class="sr-only">{brand} — {pitch}</h1>
```

## The accessibility contract

The engine builds a visually-hidden `.sw-a11y` region containing every scene's eyebrow,
title, `alt` and body in order. That region is the page for anyone not watching the video,
so:

- **Every scene needs a real `alt`.** The engine `console.warn`s without one and the mirror
  loses that scene's description. Under reduced motion the stills *are* the page.
- The visual copy layer is `aria-hidden` on purpose — the mirror owns the reading order, and
  reading both would double every sentence.
- The stage is `aria-hidden`; it is decorative.

## The Lighthouse exemption

A scroll-scrub route cannot score 100 on Performance and never will — see `budget.md`. The
route is exempt from that one assertion and from nothing else. `ASTRO.md` carries the rule.

```bash
pnpm build
pnpm exec lhci autorun                              # a11y / best-practices / seo at 1.0
node .claude/skills/scroll/scripts/scroll-audit.mjs http://localhost:4321/
node .claude/skills/scroll/scripts/scroll-audit.mjs http://localhost:4321/ --mobile
```

The audit replaces the Performance assertion. It is stricter about the things that actually
matter here — payload at the wire, the tier contract, reduced motion fetching nothing, the
memory ceiling, focus containment — none of which Lighthouse can see.

## The vanilla fallback

When the scroll page is the whole site and there is no `/about` to follow it, skip Astro:
copy `runtime/scrub-engine.js` and `demo/index.html` next to an `assets/` directory and
edit the config inline. You then own the head tags by hand, and the audit will tell you
which ones you forgot. Everything else — tiers, scripts, budget, seams — is identical.
