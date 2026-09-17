---
name: motion
description: Use when adding or reviewing animation on any page — scroll reveals, staggers, text effects, parallax, scroll-linked scenes, counters, marquees, pointer response, page transitions, and GSAP set-pieces such as pinned sequences, horizontal rails, card stacks, scrubbed scenes, self-drawing SVG and FLIP layout transitions. Carries three tested runtimes (motion.css at 0 bytes, motion.js at 4KB, motion-gsap.js driving GSAP), copy-paste recipes and showpieces, an audit script that catches the defects reviews miss, and the rules that keep motion inside a 100/100/100/100 budget.
---

# Motion

Animation that holds attention, without costing the performance budget or the accessibility score.

This skill is the **applying** half. The **deciding** half lives in `design/references/motion.md` (what motion is for, the curve vocabulary, the duration ladder) and `design/references/award-bar.md` §2 axis 4 (whether it is any good). Read those when you are choosing what to do. Read this when you are writing it.

What ships here:

| File | What it is |
|---|---|
| `runtime/motion.css` | The zero-JS tier. Tokens, scroll-driven reveals, stagger, wipes, scenes, marquee, state feedback, the reduced-motion state. Drop it in and add `data-m` attributes. |
| `runtime/motion.js` | ~4KB, no dependencies. Only what CSS cannot do: counters, line splitting, pointer response, parallax, and a reveal fallback for engines without scroll-driven animations. |
| `runtime/motion-gsap.js` + `.mjs` | The GSAP tier — UMD for a `<script src>` next to a CDN GSAP, and a one-line ESM entry (`.mjs`) for a bundled project. Ships **no GSAP** — you provide it, so you own the bundle. Twelve set-pieces behind `data-g` attributes, with `gsap.matchMedia()` and `gsap.context()` wired in so reduced motion and teardown are not left to the author. |
| `references/recipes.md` | Copy-paste markup for every tier 0/1 hook, with the reason each one earns its place. |
| `references/gsap.md` | When GSAP earns its bytes, what each plugin actually costs (measured), the ScrollTrigger contract, and the failure modes in the order they bite. |
| `references/showpieces.md` | The tier 2 catalogue: the moves a page gets built around, and the hand-authored signature moves the kit deliberately does not cover. |
| `demo/index.html` | Every tier 0/1 recipe on one page. Also the test fixture. |
| `demo/gsap.html` | Every tier 2 showpiece on one page. Also the test fixture. |
| `scripts/test-runtime.mjs` | 22 assertions over the tier 0/1 runtime. Run after any change to `runtime/motion.css` or `motion.js`. |
| `scripts/test-gsap.mjs` | 33 assertions over the tier 2 runtime, including reduced motion, degradation with no GSAP at all, and teardown. |
| `scripts/motion-audit.mjs` | Audits a **built page** for the defects that are invisible in review, including the GSAP-specific ones. Exits non-zero, so it drops into a gate. |

---

## The three tiers, in order

Start at tier 0 every time and stop as soon as the job is done. Most pages never leave it.

### Tier 0 — CSS only, 0 bytes of JavaScript

Scroll-driven animations (`animation-timeline: view()` / `scroll()`) cover reveals, staggers, wipes, push-ins, progress bars and whole scrubbed scenes with no script at all. The Astro budget says a marketing route should ship **0 bytes** of client JS, and this is how that stays true while the page still moves.

```html
<link rel="stylesheet" href="/motion.css">

<h2 data-m="reveal">Arrives as it enters</h2>

<div class="grid" data-m-stagger="60">
  <div>…</div><div>…</div><div>…</div>
</div>

<figure data-m="clip push"><img src="…" alt="…"></figure>
```

Supported in Chromium and Safari. Everywhere else the content is simply visible and static, which is a correct page rather than a broken one — the hidden state lives inside `@keyframes` behind an `@supports` gate, never in a base rule.

### Tier 1 — the runtime, ~4KB

Add `motion.js` only when you need something CSS genuinely cannot express:

- **counters** (`data-m="count"`) — arithmetic
- **line and word splitting** (`data-m-split="lines"`) — measurement of real line boxes
- **pointer response** (`magnet`, `tilt`, `spot`) — no CSS equivalent
- **parallax** (`data-m="parallax" data-m-rate="0.9"`)
- **reveal fallback** on engines without scroll-driven CSS — it adds `.m-io` and does the same job with an IntersectionObserver

```html
<script src="/motion.js" defer></script>
```

It self-mounts. Call `Motion.mount(root)` again after injecting markup.

### Tier 2 — GSAP, for set-pieces

Full reference: **`references/gsap.md`**. The catalogue: **`references/showpieces.md`**.

Measured on gsap 3.15, bundled and minified: core alone **27.5KB gzipped**, core + ScrollTrigger **45KB**, + SplitText + Flip **57KB**. That is the entire JavaScript budget for a marketing route spent in one place, so the decision gets written down rather than drifted into.

`runtime/motion-gsap.js` is the adapter. It ships no GSAP — you provide it, so the bundler and the audit both see exactly what you paid:

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionGSAP } from './motion-gsap.mjs';

MotionGSAP.init({ gsap, plugins: { ScrollTrigger } });
```

```html
<section data-g="pin" data-g-hold="90">
  <div data-g-stage>
    <div data-g-step>…</div>
    <div data-g-step>…</div>
  </div>
</section>
```

It wires in the three things people forget: `gsap.matchMedia()` so reduced motion **never builds the triggers at all** rather than shortening them, `gsap.context()` so `destroy()` removes every tween, trigger and pin spacer, and the house `cubic-bezier` curves sampled directly — because `ease: 'cubic-bezier(...)'` without CustomEase registered falls back to a default curve and says nothing.

**Reach for this tier when the page has a set-piece you can name in one sentence**, and only for what CSS genuinely cannot do: overlapping timelines, FLIP layout transitions, pinned multi-element sequences, and distances that must be re-measured on resize. Reveals, staggers, wipes, parallax, progress bars, marquees and counters are all tier 0 or tier 1, already written and already tested.

**State the byte cost in the PR and get it agreed.** If the answer is "it looks nicer", the answer is tier 0.

**Never smooth-scroll the page.** ScrollSmoother, Lenis and Locomotive override the browser's scroll rate, which breaks keyboard paging, trackpad momentum, find-in-page and the compositor handoff on phones. Pinning is fine — the browser still owns the rate. The audit warns when it finds any of the three.

---

## The attribute vocabulary

Space-separated in `data-m`, so they combine: `data-m="clip push"`.

| Attribute | Tier | Does |
|---|---|---|
| `data-m="reveal"` | 0 | Fade and rise as the element enters, then hold |
| `data-m="fade"` | 0 | Fade only, no travel |
| `data-m-stagger="60"` | 0 | Children arrive in sequence, capped at 8 |
| `data-m="clip"` | 0 | `clip-path` wipe from the bottom edge. Use it big |
| `data-m="push"` | 0 | Slow scrubbed push-in on a photograph |
| `data-m="progress"` | 0 | Scales X against document scroll |
| `data-m="scene"` | 0 | Publishes `--m-p` 0→1 across its travel, for `calc()` in plain CSS |
| `data-m="marquee"` | 0 | Continuous ticker. Content written **twice**, second copy `aria-hidden` |
| `data-m="underline"` | 0 | Underline draws from the leading edge on hover and focus |
| `data-m-press` / `data-m-hover` | 0 | Press and state feedback |
| `data-m="count"` | 1 | Counts to a **real** number on entry |
| `data-m-split="lines\|words"` | 1 | Splits and reveals each unit from behind a mask |
| `data-m="parallax" data-m-rate="0.9"` | 1 | Depth from differential travel |
| `data-m="magnet" data-m-strength="0.3"` | 1 | Drifts toward the pointer. Primary CTA only |
| `data-m="tilt" data-m-deg="7"` | 1 | Rotates toward the pointer |
| `data-m="spot"` | 1 | Publishes `--m-mx` / `--m-my` for a pointer light |

Tokens to override in your own `:root`: `--m-out`, `--m-std`, `--m-quad`, `--m-t-ui`, `--m-t-md`, `--m-rise`, `--m-stagger`, `--m-marquee-dur`.

### Tier 2 — `data-g`, read by `motion-gsap.js`

A separate namespace on purpose, so a page can run CSS reveals everywhere and spend GSAP on one section. **Never put `data-m` and `data-g` on the same element** — a CSS animation and a GSAP tween will fight over the same transform. `init()` detects it and warns.

| Attribute | Does | Extra cost |
|---|---|---|
| `data-g="chop" data-g-chop="lines\|words"` | Headline assembles line by line, each from behind its own mask, overlapping | SplitText 3.7KB, or 0 with the built-in fallback |
| `data-g="reveal"` / `data-g-stagger="60"` | Batched entrances — one trigger for a whole grid | 0 |
| `data-g="pin" data-g-hold="90"` | Frame holds, `[data-g-step]` children advance against it | 0 |
| `data-g="rail"` | `[data-g-track]` travels horizontally while pinned. Distance re-measured on refresh | 0 |
| `data-g="stack" data-g-top="72"` | `[data-g-card]` children pile up, each scaling back as the next covers it | 0 |
| `data-g="scrub" data-g-catch="1"` | `[data-g-scrub-item]` children on one scroll-scrubbed timeline | 0 |
| `data-g="draw"` | Every path in the SVG draws itself | DrawSVG 2.2KB, or 0 via `getTotalLength()` |
| `data-g="counter"` | Counts to the number already in the element's own text | 0 |
| `data-g="skew"` | Section leans into scroll velocity, clamped at 6°, returns to 0 at rest | 0 |
| `data-g="magnet" data-g-strength="0.3"` | CTA drifts toward the pointer on GSAP's own ticker | 0 |
| `data-g="mask" data-g-radius="150"` | `[data-g-mask-layer]` revealed through a circle under the cursor | 0 |
| `MotionGSAP.flip(targets, mutate)` | Layout change animated from where things **were** to where the DOM change put them | Flip 9.7KB |
| `data-g-at-load="animate"` | Opt in to animating something on the first screen, and own the LCP cost. `data-at-load="animate"` does the same for a CSS intro — the audit downgrades a *declared* hero animation from a failure to a warning, and still names the LCP risk | — |

By default an entrance device on the first screen at load **paints its final state and skips the tween**, because nothing on the first screen moves at load. That is the skill's first hard rule, enforced by the runtime rather than trusted to the author.

---

## Build order

1. **Decide what each move is for** before writing any. The four jobs are orient, reveal hierarchy, confirm, and delight once. A move doing none of them gets deleted. `design/references/motion.md` §1.
2. **Fill the motion table in the page spec** — element, trigger, move, duration, curve, reduced-motion state. If every row is identical you have applied a plugin, not choreographed a page.
3. **Link `motion.css`.** Override the tokens to match `DESIGN-GUIDELINES.md`. Two or three curves for the whole site, not nine.
4. **Mark up with `data-m`.** Start with nothing on the hero.
5. **Add `motion.js` only if the table needs it.** If nothing in the table needs tier 1, do not ship the file.
6. **Add GSAP only for a set-piece you can name in one sentence.** `references/gsap.md` §1 is the decision rule and §2 is what it costs. Load it as an island below the fold, never `client:load`. If you reach this step to fade a section in, go back to step 4.
7. **Author the one signature move by hand**, in the page, driven off `--m-p` or your own listener. The kit is the vocabulary; the signature is the sentence. A recoloured kit device is not a signature move — `references/showpieces.md` closes with the ones worth hand-authoring.
8. **Audit it.** `node scripts/motion-audit.mjs <url>` and again with `--mobile`.

---

## Hard rules

These are ship-blockers. Each one is a defect that passes review and fails on a phone.

| Never | Instead |
|---|---|
| Animate the hero | Nothing on the first screen moves at load. It delays the largest paint and steals the one screen you get for free |
| Animate `width`, `height`, `top`, `left`, `margin`, `padding`, or use `transition: all` | `transform` and `opacity`. `clip-path` for wipes |
| Write a transitioned property every frame | The transition restarts on every write and the value never arrives. Smooth the **value** in a rAF lerp, and let the property have no transition |
| Two owners for one scroll-derived value | One rAF loop owns it. Two and one of them eats the delta, and the effect dies silently |
| `ease-in` on anything entering | `ease-out`. It delays the moment the eye is already waiting for |
| Hide content that only reveals on scroll, under reduced motion | Under `prefers-reduced-motion` content is simply present. Gating on scroll is not a gentler version of the same gate |
| Re-hide content when the reader scrolls back up | Fire once and unobserve |
| Scroll-jack | Pinning is fine. Overriding the scroll rate breaks keyboard, trackpad and anyone in a hurry |
| Character-split a headline | Lines, or words for a short punch line. Characters turn reading into waiting |
| Stagger more than ~8 items | The tail arrives late enough to read as broken. Long lists reveal as a whole or in row groups |
| `will-change` as decoration | It is a loan. A page covered in it exhausts compositor memory and gets slower |
| Parallax on body copy | The reader should not be tracking a moving target |
| A counter with an invented number | Real figures or no counter. Fake precision is a credibility liability |

---

## Verify

```bash
npm i playwright-core                      # once

node scripts/test-runtime.mjs              # after any change to motion.css / motion.js
node scripts/test-gsap.mjs                 # after any change to motion-gsap.js
node scripts/test-gsap.mjs --install       # (re)fetch GSAP into demo/vendor/

node scripts/motion-audit.mjs http://localhost:4321/
node scripts/motion-audit.mjs http://localhost:4321/ --mobile
```

The audit checks: nothing animating in the first viewport at load; no layout-property animation or `transition: all`; `prefers-reduced-motion` present; the size of the easing vocabulary; frame budget across a full scripted scroll; content left stuck at opacity 0, separating an orphaned entrance from a panel legitimately hidden inside a pinned stage; `will-change` count; and reduced-motion parity. It exits non-zero on any FAIL.

**When GSAP is on the page it adds six more**, none of which any other tool catches — `getAnimations()` cannot even see a GSAP tween:

- measured **gzipped** GSAP weight and the real registered plugin list
- untriggered tweens playing at load
- pins missing `anticipatePin`
- `scrub: true` where a catch-up belongs
- pin-spacer leaks, which is a context that was never reverted
- smooth-scroll hijacking, and whether **any pin survives `prefers-reduced-motion`** — which is a FAIL, because a pinned section under reduced motion is still a section the reader has to scroll through to read

**A clean audit is not a good page.** It checks mechanics. Whether the motion means anything is `award-bar.md` §2 axis 4, and that is a judgement you make by scrolling it.

**And headless Chrome is not a phone.** It cannot reproduce iOS scroll handoff, Low Power Mode or a real touch decoder. `backdrop-filter`, large blurs and full-screen `mix-blend-mode` are the usual things that are fine on a desktop and terrible on a device — the audit's frame numbers will hint at it, but check the real thing before promising the feel.
