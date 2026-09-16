---
name: motion
description: Use when adding or reviewing animation on any page — scroll reveals, staggers, text effects, parallax, scroll-linked scenes, counters, marquees, pointer response, page transitions. Carries a tested zero-dependency runtime (motion.css + motion.js), copy-paste recipes for the moves that hold attention, an audit script that catches the defects reviews miss, and the rules that keep motion inside a 100/100/100/100 budget.
---

# Motion

Animation that holds attention, without costing the performance budget or the accessibility score.

This skill is the **applying** half. The **deciding** half lives in `design/references/motion.md` (what motion is for, the curve vocabulary, the duration ladder) and `design/references/award-bar.md` §2 axis 4 (whether it is any good). Read those when you are choosing what to do. Read this when you are writing it.

What ships here:

| File | What it is |
|---|---|
| `runtime/motion.css` | The zero-JS tier. Tokens, scroll-driven reveals, stagger, wipes, scenes, marquee, state feedback, the reduced-motion state. Drop it in and add `data-m` attributes. |
| `runtime/motion.js` | ~4KB, no dependencies. Only what CSS cannot do: counters, line splitting, pointer response, parallax, and a reveal fallback for engines without scroll-driven animations. |
| `references/recipes.md` | Copy-paste markup for every hook, with the reason each one earns its place. |
| `demo/index.html` | Every recipe on one page. Also the test fixture. |
| `scripts/test-runtime.mjs` | 22 assertions over the runtime. Run after any change to `runtime/`. |
| `scripts/motion-audit.mjs` | Audits a **built page** for the defects that are invisible in review. Exits non-zero, so it drops into a gate. |

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

### Tier 2 — a real library

GSAP + ScrollTrigger, Lenis, Framer Motion. Reach for these only when the brief needs choreography the above cannot do: timeline sequencing with overlapping tweens, FLIP layout transitions, physics, a genuinely continuous camera flight.

**State the byte cost in the PR and get it agreed.** GSAP core plus ScrollTrigger is ~70KB gzipped, which is the entire JS budget for a marketing route. If the answer is "it looks nicer", the answer is tier 0.

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

---

## Build order

1. **Decide what each move is for** before writing any. The four jobs are orient, reveal hierarchy, confirm, and delight once. A move doing none of them gets deleted. `design/references/motion.md` §1.
2. **Fill the motion table in the page spec** — element, trigger, move, duration, curve, reduced-motion state. If every row is identical you have applied a plugin, not choreographed a page.
3. **Link `motion.css`.** Override the tokens to match `DESIGN-GUIDELINES.md`. Two or three curves for the whole site, not nine.
4. **Mark up with `data-m`.** Start with nothing on the hero.
5. **Add `motion.js` only if the table needs it.** If nothing in the table needs tier 1, do not ship the file.
6. **Author the one signature move by hand**, in the page, driven off `--m-p` or your own listener. The kit is the vocabulary; the signature is the sentence. A recoloured kit device is not a signature move.
7. **Audit it.** `node scripts/motion-audit.mjs <url>` and again with `--mobile`.

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

node scripts/test-runtime.mjs              # after any change to runtime/
node scripts/motion-audit.mjs http://localhost:4321/
node scripts/motion-audit.mjs http://localhost:4321/ --mobile
```

The audit checks: nothing animating in the first viewport at load; no layout-property animation or `transition: all`; `prefers-reduced-motion` present; the size of the easing vocabulary; frame budget across a full scripted scroll; content left stuck at opacity 0; `will-change` count; and reduced-motion parity. It exits non-zero on any FAIL.

**A clean audit is not a good page.** It checks mechanics. Whether the motion means anything is `award-bar.md` §2 axis 4, and that is a judgement you make by scrolling it.

**And headless Chrome is not a phone.** It cannot reproduce iOS scroll handoff, Low Power Mode or a real touch decoder. `backdrop-filter`, large blurs and full-screen `mix-blend-mode` are the usual things that are fine on a desktop and terrible on a device — the audit's frame numbers will hint at it, but check the real thing before promising the feel.
