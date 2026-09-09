# Scoring 100 / 100 / 100 / 100

The target is all four Lighthouse categories at 100 on **mobile**, which is what PageSpeed Insights reports first and what real users experience. Desktop follows for free; the reverse is not true.

This is a checklist, not advice. Work it top down. Each item names the audit it satisfies.

---

## 1. Performance

Mobile Lighthouse throttles to a mid-tier phone on slow 4G. At that speed, the only reliable strategy is to send less. Astro's default output already sends almost nothing — the score is lost by adding things back.

### Largest Contentful Paint (target < 2.5s, realistically < 1.2s)

The LCP element on almost every page here is the hero image or the hero headline.

**If it is an image:**

```astro
---
import { Image } from 'astro:assets';
import hero from '../assets/hero.jpg';
---
<Image
  src={hero}
  alt="Ballroom set for a 400-guest wedding reception"
  widths={[640, 960, 1440, 1920]}
  sizes="100vw"
  loading="eager"
  fetchpriority="high"
  decoding="sync"
  format="avif"
  quality={72}
  class="h-full w-full object-cover"
/>
```

- `loading="eager"` + `fetchpriority="high"` on the LCP image, and **only** on it. Marking three images high priority is the same as marking none.
- Never a CSS `background-image` for the LCP element — the browser cannot discover it until the CSS parses, which costs several hundred milliseconds. Use an `<img>` positioned behind content with `absolute inset-0 -z-10`.
- No fade-in, no `opacity-0` → `opacity-100` transition on the LCP element. Lighthouse measures when it is *painted*, and an entrance animation delays that by exactly the animation duration.
- `quality={72}` on AVIF is visually indistinguishable from 90 at a third of the bytes. Check the actual file: a hero over ~150KB needs another look.

**If it is text:** the font must not block it. See §3.

### Cumulative Layout Shift (target 0, and 0 is achievable)

Every shift is one of four things:

| Cause | Fix |
|---|---|
| Image without dimensions | `astro:assets` sets them from the file. For remote images, pass `width`/`height` yourself — always. |
| Media in a fluid container | `class="aspect-[16/9]"` on the wrapper so the box exists before the bytes do. |
| Font swap reflow | `size-adjust` on the fallback face (§3), or accept a metric-compatible fallback stack. |
| JS inserting or resizing content | Reserve the space in the HTML. An island that renders taller than its placeholder is a CLS bug. |

Check it in DevTools with the "Layout Shift Regions" overlay on a 4x-throttled reload — the number in Lighthouse tells you there is a problem, the overlay tells you where.

### Total Blocking Time (target 0)

- Every `client:*` directive is a bundle. Audit them: `grep -rn "client:" src/`. Each one needs a reason a `<script>` tag could not do the job.
- `client:load` runs before the page is interactive and is the single most common cause of a non-100 performance score in an Astro project. Use `client:visible` for anything below the fold and `client:idle` for anything not needed immediately.
- **No third-party scripts.** No GTM, no chat widget, no font CDN, no embedded map iframe loaded eagerly. Each one is 100–600ms of main-thread time you do not control and cannot fix.
  - Analytics: a self-hosted lightweight beacon, or Partytown if a vendor script is unavoidable.
  - Maps: a static map image linking to the real map. Load the interactive embed on click. This alone is often the difference between 78 and 100.
  - Video: a poster image that swaps in the iframe on click.

### CSS

- Tailwind v4 emits only used utilities. Keep it that way: no `safelist`, no dynamically built class strings (`` `text-${color}-500` `` produces nothing at build and a missing style at runtime — pass whole class names or use a token).
- `build.inlineStylesheets: 'auto'` inlines small sheets and cuts a render-blocking request. Keep per-page CSS under ~14KB so it fits the first TCP window.
- Never `@import` a stylesheet at runtime. Never a `<link>` to an external CSS host.

### JavaScript

- `astro build` reports the client bundle per route. A marketing page should be **0 bytes**. A page with two islands should be under 15KB gzipped. If a route ships 100KB, something imported a framework into a section.
- Watch out for a util file that pulls in a date library. `date-fns` tree-shakes; `moment` does not.

### Caching (host config, but it is your job)

```
/_astro/*   Cache-Control: public, max-age=31536000, immutable
/*.html     Cache-Control: public, max-age=0, must-revalidate
```

Content-hashed asset filenames make the immutable header safe. Without it, "Serve static assets with an efficient cache policy" costs points on every repeat run.

---

## 2. Accessibility

100 here is entirely achievable and mostly decided before any code exists — by the colour tokens. Which is why the design guidelines carry a measured contrast table.

### Contrast

- Body text ≥ **4.5:1**. Large text (≥24px, or ≥18.66px bold) and UI boundaries ≥ **3:1**.
- Every pair that ships is in `DESIGN-GUIDELINES.md` with its measured ratio. If a pair is not in the table, it is not approved.
- The usual failures: muted text on a tinted surface, white text on the accent colour, placeholder text, disabled buttons, and text over a photograph. For text over a photo, use a scrim (`bg-gradient-to-t from-black/70`) and measure against the darkest point of the gradient, not the average.

### Structure

- One `<h1>` per page. Levels descend without gaps — no `h2` → `h4`. Visual size is a separate axis; that is what `Heading`'s `as` / `size` split is for.
- Landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`. Exactly one `<main>`.
- A skip link as the first focusable element:

  ```html
  <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-[--color-accent] focus:px-4 focus:py-2 focus:text-[--color-accent-ink]">Skip to content</a>
  ```

- `<html lang="en">`. Missing `lang` fails both accessibility and SEO.

### Interaction

- Visible focus on everything focusable. `outline-none` without a replacement `:focus-visible` style is a defect — the global base style in §Step 2 covers it; do not override it locally.
- Tap targets ≥ 24×24 CSS px with adequate spacing (Lighthouse's threshold; 44px is the better design target). Footer link lists and social icon rows are where this fails.
- Anything clickable is a `<button>` or an `<a>`. A `div` with a click handler has no role, no keyboard access, and no focus.
- Forms: every input has a `<label for>`. Placeholder is not a label. Errors are associated with `aria-describedby` and announced with `role="alert"`.
- `aria-current="page"` on the active nav link.
- Icon-only buttons need an accessible name — `aria-label`, and `aria-hidden="true"` on the decorative icon inside.

### Images

- Meaningful images get descriptive alt text — what it shows, not "image of".
- Decorative images get `alt=""`. Not a missing `alt`, not a filename.
- Text inside an image is invisible to search and screen readers. If the design has a headline baked into an image, that is a design bug — raise it.

### Motion

`prefers-reduced-motion` is honoured globally in the base layer. Any bespoke animation added later must respect it too.

---

## 3. Fonts (the crossover item — hits Performance, CLS and Accessibility)

Self-host. Always. A Google Fonts `<link>` costs a DNS lookup, a TLS handshake and a render-blocking request to a third-party origin, and it is the most common single reason an otherwise clean Astro page scores in the 80s.

```bash
pnpm add @fontsource-variable/inter @fontsource-variable/fraunces
```

```css
/* global.css, before @theme */
@import '@fontsource-variable/inter/wght.css';
@import '@fontsource-variable/fraunces/index.css';
```

Then in `Base.astro`'s head, preload only the faces used above the fold:

```html
<link rel="preload" as="font" type="font/woff2" href="/_astro/inter-latin-wght-normal.woff2" crossorigin />
```

- **Variable fonts, one file per family.** Two families is the ceiling — a display face and a text face.
- **Subset to `latin`** unless the site needs more. A full unicode-range font is several times the size.
- `font-display: swap` (fontsource sets it). Never `block`.
- Kill the swap reflow with a metric-matched fallback:

  ```css
  @font-face {
    font-family: 'Inter Fallback';
    src: local('Arial');
    size-adjust: 107%;
    ascent-override: 90%;
    descent-override: 22%;
    line-gap-override: 0%;
  }
  ```

  and put `'Inter Fallback'` in the stack ahead of `sans-serif`. This is how CLS reaches actual zero rather than 0.02.

If the installed Astro version has the stable `astro:fonts` API, prefer it — it does the subsetting, preloading and fallback metrics automatically. Check before assuming it exists.

---

## 4. Best Practices

Cheap points, lost by carelessness.

- **Zero console errors or warnings** in the production build. Lighthouse reads the console.
- HTTPS everywhere, including every asset reference and every external link.
- `rel="noopener"` on every `target="_blank"` (`noreferrer` too unless the referrer is wanted).
- Images served at their displayed size — the `widths` + `sizes` pair from §1 handles this. A 2400px image in a 400px slot fails "Properly size images" and wastes the user's data.
- Image `width`/`height` must match the real aspect ratio, or "Displays images with incorrect aspect ratio" fires.
- No deprecated APIs, no `document.write`, no `unload` listeners.
- A CSP is worth adding for the header audit; `default-src 'self'` plus what the site actually needs. Verify nothing inline breaks.

---

## 5. SEO

100 here is mechanical. Every item below is checkable.

### Per page — owned by `Base.astro`, never by a section

```astro
---
interface Props { title: string; description: string; image?: string; noindex?: boolean; }
const { title, description, image = '/og/default.jpg', noindex = false } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
---
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
{noindex && <meta name="robots" content="noindex, nofollow" />}

<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={new URL(image, Astro.site)} />
<meta name="twitter:card" content="summary_large_image" />
```

- **Title**: unique per page, ≤ 60 characters, the specific thing first and the brand last.
- **Description**: unique per page, 120–160 characters, written for a human deciding whether to click.
- **Viewport**: exactly as above. Adding `maximum-scale=1` or `user-scalable=no` fails accessibility.
- **OG image**: 1200×630, and it must actually exist — a 404 on `og:image` is invisible locally and obvious in a link preview.

### Site-wide

- `@astrojs/sitemap` with `site` set. Reference it from `public/robots.txt`:

  ```
  User-agent: *
  Allow: /
  Sitemap: https://example.com/sitemap-index.xml
  ```

- **Crawlable links.** Every navigation is a real `<a href>` with real text. A router-driven `<div onclick>` is invisible to a crawler — this is a direct Lighthouse SEO failure, not a subtlety.
- Anchor text says where it goes. "Read more" ×12 on a blog index is a real, if minor, problem; "Read: How we plan a 400-guest wedding" is better for both audits and humans.
- Font size ≥ 12px and tap targets sized — both are scored under SEO on mobile as well as accessibility.

### Structured data (JSON-LD, in `<head>`)

Not scored directly by Lighthouse, but it is the difference between a plain result and a rich one, and it is free.

```astro
<script type="application/ld+json" set:html={JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Eventrra',
  url: Astro.site,
  telephone: '+880...',
  address: { '@type': 'PostalAddress', streetAddress: '...', addressLocality: '...', addressCountry: 'BD' },
  sameAs: ['https://instagram.com/...', 'https://facebook.com/...'],
})} />
```

Per page type: `BlogPosting` on a post, `BreadcrumbList` on anything nested, `FAQPage` on the FAQ section, `Service` on service pages, `ImageGallery` on the portfolio. Validate at `search.google.com/test/rich-results` before shipping — a malformed block is worse than none.

---

## When a score is not 100

Read the audit, do not guess. Lighthouse names the failing element.

| Symptom | Almost always |
|---|---|
| Performance 85–95, TBT high | A `client:load` island, or a third-party script |
| Performance ~90, LCP slow | Hero as a CSS background, missing `fetchpriority`, an oversized image, or a font blocking the headline |
| CLS 0.05–0.2 | An image without dimensions, or font swap without `size-adjust` |
| Accessibility 90s | Contrast on muted text, missing form label, or a heading level gap |
| Best Practices 90s | A console error, or an image aspect-ratio mismatch |
| SEO 90s | Missing description, missing canonical, or non-crawlable links |

Fix the cause, re-run, and only then move on. A page that passes at 100 once will keep passing — the regressions come from the next feature, which is why `lhci autorun` lives in `pnpm check` and not in someone's memory.
