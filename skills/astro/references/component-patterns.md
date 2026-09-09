# Component Patterns

Worked source for every component shape this stack uses. Copy from here rather than inventing a variant.

The rule underneath all of it: **a component owns one decision.** `Container` owns horizontal rhythm. `Section` owns vertical rhythm. `Heading` owns type scale. When one component owns two decisions, the second one is the one you cannot reuse.

---

## Primitives

### `Container.astro`

The only file in the project that sets horizontal padding. Every section wraps its content in one.

```astro
---
interface Props {
  size?: 'narrow' | 'default' | 'wide' | 'full';
  as?: 'div' | 'section' | 'article' | 'header' | 'footer';
  class?: string;
}
const { size = 'default', as: Tag = 'div', class: className = '' } = Astro.props;

const widths = {
  narrow: 'max-w-3xl',
  default: 'max-w-[80rem]',
  wide: 'max-w-[90rem]',
  full: 'max-w-none',
} as const;
---
<Tag class:list={['mx-auto w-full px-[--spacing-gutter]', widths[size], className]}>
  <slot />
</Tag>
```

`class:list` is Astro's built-in — no `clsx` dependency. The `class` prop passthrough is what keeps a component reusable without a `variant` explosion.

### `Section.astro`

```astro
---
interface Props {
  tone?: 'base' | 'raised' | 'accent';
  id?: string;
  labelledby?: string;
  class?: string;
}
const { tone = 'base', id, labelledby, class: className = '' } = Astro.props;

const tones = {
  base: 'bg-[--color-surface] text-[--color-ink]',
  raised: 'bg-[--color-surface-raised] text-[--color-ink]',
  accent: 'bg-[--color-accent] text-[--color-accent-ink]',
} as const;
---
<section id={id} aria-labelledby={labelledby} class:list={['py-[--spacing-section]', tones[tone], className]}>
  <slot />
</section>
```

`aria-labelledby` pointing at the section's own heading id is what turns a `<section>` into a navigable landmark. A `<section>` with no accessible name is just a `<div>`.

### `Heading.astro`

Level and size are independent axes. This is the component that keeps heading order correct while the design does what it wants visually.

```astro
---
interface Props {
  as: 'h1' | 'h2' | 'h3' | 'h4';
  size?: 'display' | 'h2' | 'h3' | 'body';
  id?: string;
  class?: string;
}
const { as: Tag, size = 'h2', id, class: className = '' } = Astro.props;

const sizes = {
  display: 'text-[length:--text-display] font-[--font-display] leading-[0.95] tracking-[-0.02em]',
  h2: 'text-[length:--text-h2] font-[--font-display] leading-[1.1] tracking-[-0.01em]',
  h3: 'text-2xl font-[--font-display] leading-tight',
  body: 'text-[length:--text-body] font-[--font-sans]',
} as const;
---
<Tag id={id} class:list={[sizes[size], 'text-balance', className]}><slot /></Tag>
```

`text-balance` on headings and `text-pretty` on paragraphs cost nothing and fix the ragged last line that makes a hero look unfinished.

### `Button.astro`

Renders the right element for the job. A link that looks like a button is still a link.

```astro
---
interface Props {
  href?: string;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
  class?: string;
  [key: string]: unknown;
}
const { href, variant = 'primary', type = 'button', class: className = '', ...rest } = Astro.props;

const base =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide ' +
  'transition-colors duration-200 min-h-11 focus-visible:outline-2 focus-visible:outline-offset-3';
const variants = {
  primary: 'bg-[--color-accent] text-[--color-accent-ink] hover:brightness-110',
  ghost: 'border border-[--color-ink]/25 text-[--color-ink] hover:border-[--color-accent] hover:text-[--color-accent]',
} as const;
const Tag = href ? 'a' : 'button';
---
<Tag
  href={href}
  type={href ? undefined : type}
  class:list={[base, variants[variant], className]}
  {...rest}
><slot /></Tag>
```

`min-h-11` (44px) is the tap target floor. External links passed through `...rest` must carry `rel="noopener"` — check the call site.

---

## `Base.astro` — the only file that touches `<head>`

```astro
---
import '../styles/global.css';
interface Props {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}
const { title, description, image = '/og/default.jpg', noindex = false, jsonLd } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
---
<!doctype html>
<html lang="en" class="scroll-smooth">
  <head>
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

    <link rel="sitemap" href="/sitemap-index.xml" />
    <link rel="alternate" type="application/rss+xml" title="Journal" href="/rss.xml" />

    {jsonLd && <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />}
  </head>
  <body class="bg-[--color-surface] font-[--font-sans] text-[--color-ink] antialiased">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-[--color-accent] focus:px-4 focus:py-2 focus:text-[--color-accent-ink]"
    >Skip to content</a>

    <slot name="header" />
    <main id="main"><slot /></main>
    <slot name="footer" />
  </body>
</html>
```

---

## Sections

### The shape every section takes

```astro
---
import Container from '../primitives/Container.astro';
import Section from '../primitives/Section.astro';
import Heading from '../primitives/Heading.astro';

interface Props {
  eyebrow?: string;
  title: string;
  items: readonly { title: string; body: string }[];
}
const { eyebrow, title, items } = Astro.props;
const headingId = 'services-title';
---
<Section labelledby={headingId}>
  <Container>
    <div class="max-w-2xl">
      {eyebrow && (
        <p class="mb-3 text-xs uppercase tracking-[0.2em] text-[--color-accent]">{eyebrow}</p>
      )}
      <Heading as="h2" size="h2" id={headingId}>{title}</Heading>
    </div>

    <ul class="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li>
          <h3 class="text-lg font-medium">{item.title}</h3>
          <p class="mt-2 text-[--color-ink-muted] text-pretty">{item.body}</p>
        </li>
      ))}
    </ul>
  </Container>
</Section>
```

Note what is absent: no data fetching, no `client:` directive, no hardcoded copy, no wrapper card around each item. A list of things is a `<ul>`; giving each item a bordered box is the reflex to resist.

### Responsive grids

`grid` + `gap` handles nearly everything. Reach for these before a media query:

```html
<!-- auto-fit: no breakpoints at all, columns appear as room allows -->
<div class="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">

<!-- an asymmetric editorial split that collapses cleanly -->
<div class="grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">

<!-- a mobile scroll rail that becomes a desktop grid — no carousel JS -->
<ul class="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible">
  <li class="min-w-[80%] snap-start md:min-w-0">…</li>
</ul>
```

That last pattern replaces a carousel island on most marketing sites. It is native, accessible, keyboard-scrollable, and 0 bytes of JavaScript.

---

## Images

```astro
---
import { Image, Picture } from 'astro:assets';
import cover from '../assets/portfolio/rooftop.jpg';
---
<!-- LCP image: eager, high priority, no entrance animation -->
<Image src={cover} alt="Rooftop dinner set for sixty under string lights"
       widths={[640, 960, 1440]} sizes="(min-width: 1024px) 60vw, 100vw"
       loading="eager" fetchpriority="high" format="avif" quality={72}
       class="h-full w-full object-cover" />

<!-- everything else: lazy, aspect-ratio locked so the box exists first -->
<div class="aspect-[4/3] overflow-hidden rounded-sm">
  <Image src={cover} alt="" widths={[400, 800]} sizes="(min-width: 768px) 33vw, 90vw"
         loading="lazy" decoding="async" class="h-full w-full object-cover" />
</div>
```

Remote images need explicit `width`/`height` and a `domains`/`remotePatterns` entry in `astro.config.mjs`. Without the dimensions you get CLS; without the config you get a build error.

---

## The four island patterns

### 1. Accordion — no JavaScript at all

```html
<details class="group border-b border-[--color-ink]/15 py-5">
  <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium">
    How far in advance should we book?
    <span aria-hidden="true" class="transition-transform group-open:rotate-45">+</span>
  </summary>
  <p class="mt-3 text-[--color-ink-muted] text-pretty">Six to nine months for a full production…</p>
</details>
```

Keyboard, screen readers, and find-in-page all work for free. An accordion built with a framework is a worse accordion.

### 2. Tabs / filters — HTML works, script enhances

All panels render in the HTML. With JS off, the visitor sees everything, which is the correct degradation for a portfolio filter. See the `SKILL.md` Step 6 source, including the arrow-key handling.

### 3. Mobile navigation — `<dialog>`

```astro
<button aria-label="Open menu" data-menu-open class="md:hidden">…</button>
<dialog data-menu class="m-0 h-dvh max-h-none w-full max-w-none bg-[--color-surface] p-6 backdrop:bg-black/60">
  <button aria-label="Close menu" data-menu-close>…</button>
  <nav aria-label="Mobile"><slot /></nav>
</dialog>

<script>
  const dlg = document.querySelector('[data-menu]') as HTMLDialogElement | null;
  document.querySelector('[data-menu-open]')?.addEventListener('click', () => dlg?.showModal());
  document.querySelector('[data-menu-close]')?.addEventListener('click', () => dlg?.close());
</script>
```

`showModal()` gives focus trapping, Escape-to-close, and inert background for free. Hand-rolling those is where accessibility bugs come from.

### 4. Forms — progressive, then enhanced

The form is a real `<form method="POST" action="...">` that works submitted plainly. The script intercepts for inline validation and an in-place success state.

```astro
<form method="POST" action="/api/enquiry" data-enquiry class="grid gap-5 sm:grid-cols-2">
  <div class="grid gap-2">
    <label for="name" class="text-sm">Full name</label>
    <input id="name" name="name" required autocomplete="name" aria-describedby="name-error"
           class="min-h-11 rounded-sm border border-[--color-ink]/25 bg-transparent px-3" />
    <p id="name-error" role="alert" class="hidden text-sm text-red-400"></p>
  </div>
  <button type="submit" class="sm:col-span-2">Send enquiry</button>
</form>
```

Every input: a real `<label for>`, an `autocomplete` token, and an error paragraph wired with `aria-describedby`. Placeholders are not labels.

---

## Naming and file rules

- One component per file, `PascalCase.astro`, named for what it **is** in the design — not what it looks like. `CtaBanner`, not `GoldStripe`.
- `interface Props` at the top of every component. No untyped `Astro.props`.
- A component used on two pages lives in `sections/`; a component used inside exactly one section can stay a local block in that file until a second caller appears. Do not pre-abstract.
- Ordering inside a file: imports → `interface Props` → destructure → derived values → markup → scoped `<script>`.
