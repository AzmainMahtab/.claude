# GSAP — tier 2

Tier 0 is CSS and 0 bytes. Tier 1 is 4KB. **This tier is 45KB gzipped before you have animated anything**, which is the entire JavaScript budget for a marketing route spent in one place.

That is not an argument against it. It is the reason the decision gets written down.

---

## 1. When it earns its bytes

GSAP is the right answer when the page has a **set-piece** — a moment the page is partly built around — that needs one of these four things:

| It needs | Because CSS cannot |
|---|---|
| **A timeline with overlapping tweens** | `animation-delay` sequences; it does not let step 3 start 0.2s before step 2 ends and share an ease with it |
| **A layout transition (FLIP)** | There is no CSS way to animate an element from where it *was* to where a DOM change *put it* |
| **Pinning with a scrubbed timeline of many elements** | `position: sticky` plus `animation-timeline` gets close, and falls apart the moment the sequence branches |
| **Measured, re-measurable distances** | A horizontal rail's travel is `scrollWidth − offsetWidth`, recomputed on every resize and font swap |

It is the **wrong** answer for: reveals, staggers, wipes, parallax, progress bars, marquees, hover states, counters. Every one of those is tier 0 or tier 1, already written, already tested. Reaching for GSAP to fade a section in is 45KB for something that costs nothing.

**The decision rule.** If you cannot name the set-piece in one sentence, and point at the row in the page spec's motion table that requires it, you do not need this tier.

---

## 2. What it actually costs

Measured on **gsap 3.15.0**, bundled with esbuild, minified, gzip -9. These are transfer bytes, not raw:

| Bundle | Gzipped |
|---|---|
| `gsap` core alone | **27.5KB** |
| core + ScrollTrigger | **45KB** |
| core + ScrollTrigger + SplitText + Flip | **57KB** |

Per plugin, from the prebuilt `dist/*.min.js`:

| Plugin | Gzipped | Worth it when |
|---|---|---|
| ScrollTrigger | 18.0KB | Anything scroll-driven. This is the one you are really buying |
| Flip | 9.7KB | A filterable/sortable grid, or a card that expands into a detail view |
| MorphSVGPlugin | 9.6KB | One shape genuinely becomes another. Rare, and unmistakable when real |
| MotionPathPlugin | 9.7KB | Something follows a curve you drew. Not a substitute for x/y |
| ScrollSmoother | 5.5KB | **Almost never.** See §7 |
| Observer | 4.3KB | Unified wheel/touch/pointer without writing three listeners |
| CustomEase | 3.7KB | You want the house `cubic-bezier` verbatim. The runtime avoids this — see §4 |
| ScrambleTextPlugin | 4.0KB | One headline, once. Two is a gimmick |
| SplitText | 3.7KB | Line-accurate splitting that re-splits on resize. Cheap and good |
| TextPlugin | 3.6KB | Typewriter. Usually a worse version of a fade |
| InertiaPlugin | 3.3KB | Throw-to-settle on a draggable. `quickTo` covers magnetic hovers for 0 extra |
| DrawSVGPlugin | 2.2KB | Convenience only — `getTotalLength()` and a dasharray do the same for free |
| ScrollToPlugin | 2.0KB | Animated anchor scrolling. `scroll-behavior: smooth` is free |
| Physics2DPlugin | 1.2KB | Confetti, sparks, debris |
| EasePack | 1.3KB | `rough`, `slowMo`, `expoScale` |

**Tree-shaking barely helps.** The core is monolithic: importing only `gsap.to` still costs 27.5KB. Budget for the whole core the moment you import anything.

### Licence

GSAP 3.13+ ships **every plugin in the public npm package** — SplitText, MorphSVG, ScrollSmoother and the rest included — under the Standard "no charge" licence. There is no Club paywall to work around and no private registry to configure. If the end product is a template or theme that is itself resold with GSAP inside it, read <https://gsap.com/standard-license> first; for a site you build for one client or one company, it is free.

---

## 3. Install and load

```bash
pnpm add gsap
```

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { MotionGSAP } from './motion-gsap.mjs';

MotionGSAP.init({ gsap, plugins: { ScrollTrigger, SplitText } });
```

Import from **`motion-gsap.mjs`** in a bundled project. `motion-gsap.js` is UMD so it can also be dropped in with a plain `<script src>` beside a CDN copy of GSAP; the `.mjs` is a one-line re-export of the global it sets.

**Register every plugin you import.** A bundler drops an imported-but-unregistered plugin as dead code, so the page works in dev and silently loses the effect in the build. `MotionGSAP.init` registers whatever you hand it, which is most of why it exists.

### In Astro

This is an island, and it is the one island a marketing route is allowed. Never `client:load` — the set-piece is below the fold by definition, so the cost belongs after first paint:

```astro
---
import Showpiece from '../components/islands/Showpiece.astro';
---
<Showpiece client:visible />
```

Or, without a framework island at all — a plain module script, which is lighter and is usually enough:

```astro
<section id="showpiece" data-g="pin"> … </section>

<script>
  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  const { MotionGSAP } = await import('/motion-gsap.mjs');
  MotionGSAP.init({ gsap, plugins: { ScrollTrigger } });
</script>
```

**Say the byte cost in the PR description and get it agreed.** A route that was 26KB and is now 71KB has changed category, and that is a decision someone should make on purpose.

---

## 4. Eases: keep the site's two curves

GSAP's named eases are *not* the same shapes as the site's CSS curves. `power2.out` is close to `cubic-bezier(0.2, 0.8, 0.2, 1)` and not equal to it, and a page where half the moves use one and half use the other reads as subtly inconsistent without anyone being able to say why.

Two honest options:

**a. Register CustomEase (3.7KB) and use the literal string.**

```js
import { CustomEase } from 'gsap/CustomEase';
gsap.registerPlugin(CustomEase);
CustomEase.create('house', '0.2, 0.8, 0.2, 1');
gsap.to(el, { y: 0, ease: 'house' });
```

**b. Sample the bezier yourself, for 0 bytes.** This is what `motion-gsap.js` does, and it is why the runtime does not need CustomEase:

```js
function bezier(x1, y1, x2, y2) {
  const bx = (t) => { const u = 1 - t; return 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t; };
  const by = (t) => { const u = 1 - t; return 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t; };
  return (p) => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let lo = 0, hi = 1, t = p;
    for (let i = 0; i < 18; i++) { t = (lo + hi) / 2; bx(t) < p ? lo = t : hi = t; }
    return by(t);
  };
}
gsap.to(el, { y: 0, ease: bezier(0.2, 0.8, 0.2, 1) });
```

**Do not pass `ease: 'cubic-bezier(...)'` and assume it works.** Without CustomEase registered, GSAP falls back to a default curve and says nothing. The site quietly loses its vocabulary and the audit's curve count will not catch it, because the string is never in the CSS.

After `init()`, `MotionGSAP.ease.out` / `.std` / `.quad` are the sampled house curves, so a page authoring its own signature move uses the site's vocabulary instead of reaching for `power2.out` and quietly widening the curve count the audit reports.

`ease: 'none'` for anything scrubbed. A scrubbed tween with an ease fights the reader's hand — they move at a constant rate and the thing on screen does not.

---

## 5. ScrollTrigger, the parts that matter

```js
ScrollTrigger.create({
  trigger: section,
  start: 'top 80%',        // trigger's top hits 80% down the viewport
  end: 'bottom 40%',
  scrub: 0.8,              // seconds of catch-up
  pin: stage,
  anticipatePin: 1,
  invalidateOnRefresh: true,
  once: true,
});
```

- **`scrub: 0.6`–`1`, not `scrub: true`.** `true` is glued to the exact wheel delta, so trackpad jitter transfers straight to the screen. A short catch-up is the difference between "linked to my scroll" and "weighted".
- **`once: true` on every entrance.** Content that re-hides on the way back up is a defect, not a flourish.
- **`invalidateOnRefresh: true` on anything whose distance is measured.** Without it a rail computed at 1440 keeps that distance at 390.
- **`anticipatePin: 1` on every pin.** The pin engages one frame late otherwise, which is the whole of the "why does my pinned section stutter" genre.
- **`ScrollTrigger.batch()` for groups.** One trigger for a 12-card grid instead of twelve.
- **Refresh after fonts.** Every pinned and scrubbed distance is measured from layout, and layout changes when the webface swaps. `document.fonts.ready.then(() => ScrollTrigger.refresh())`. Skip this and the page is right in dev with a warm cache and wrong on a cold load.

### Functional values

Anything measured is a function, not a number, so `invalidateOnRefresh` can re-run it:

```js
// wrong — measured once, at whatever width the page happened to load at
gsap.to(track, { x: -(track.scrollWidth - el.offsetWidth) });

// right
gsap.to(track, { x: () => -(track.scrollWidth - el.offsetWidth) });
```

---

## 6. Reduced motion is `matchMedia`, and it is not optional

```js
const mm = gsap.matchMedia();

mm.add({
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
}, (ctx) => {
  const { motion } = ctx.conditions;
  if (!motion) {
    gsap.set('[data-g-step]', { opacity: 1, clearProps: 'transform' });
    return;                       // no ScrollTriggers built at all
  }
  buildTheShowpiece();
});
```

Three things this buys that a plain `if (reduce)` does not:

1. **It tears down.** When the preference changes mid-session, GSAP reverts everything the other branch built. A manual check never un-builds, so a page that respected the setting at load stops respecting it the moment someone toggles it in the OS.
2. **It scopes.** The reduce branch can build a genuinely different, simpler thing rather than a crippled version of the complex one.
3. **The audit can see it.** `motion-audit.mjs` loads the page with `reducedMotion: 'reduce'` and **fails** if any pin was built, because a pinned section under reduced motion is still a section the reader has to scroll through to find out what it says.

**Shortening durations is not a reduced-motion state.** A 200ms scrubbed pin is the same gate as a 2000ms one.

---

## 7. What not to do

### Do not smooth-scroll the page

ScrollSmoother, Lenis and Locomotive all override the browser's scroll rate. That breaks:

- **Keyboard** — Page Down, Space and Home/End stop landing where the reader expects
- **Trackpad momentum** — the OS curve and the library's curve fight
- **Find-in-page** — the browser jumps, the library animates, and they disagree
- **Anyone in a hurry** — a fast flick is now a slow ride they cannot skip
- **Phones** — the scroll handoff to the compositor is gone, so it runs on the main thread

Pinning is fine — the browser still owns the scroll rate. Changing the rate is not. `motion-audit.mjs` warns when it detects any of the three, and on a phone it is the first thing to remove when the page feels bad.

### Do not split a headline per character

`SplitText({ type: 'chars' })` on an `h1` turns reading into waiting, and it hands a screen reader 48 individual spans. Lines, or words for a short punch line. `SplitText` restores the original markup on `revert()`, and `aria-label` on the element keeps the accessible name intact.

### Do not pin the page's main argument

A pinned section is a section the reader cannot skim. Use it for a demonstration, a process, a product turning around. Never for the paragraph that says what the company does.

### Do not animate the hero

Same rule as every other tier, and it is easier to break here because a ScrollTrigger with `start: 'top 80%'` is *already past* at load for anything on the first screen, so it fires immediately. `motion-gsap.js` detects this and paints the final state instead; opt in per element with `data-g-at-load="animate"` if the intro is genuinely wanted, and then own the LCP cost.

### Do not leave contexts unreverted

```js
const ctx = gsap.context(() => { /* everything */ }, scopeEl);
// later, on unmount / before a view transition
ctx.revert();
```

Without this, an Astro view transition or an SPA navigation leaves the pin spacers in the DOM. The page grows taller on every navigation and nobody can reproduce it, because it needs two navigations to show up. The audit counts pin spacers against pins and fails when they diverge.

---

## 8. Failure modes, in the order they bite

| Symptom | Cause | Fix |
|---|---|---|
| Works in dev, effect gone in prod | Plugin imported, never registered — the bundler dropped it | `gsap.registerPlugin(ScrollTrigger)` |
| Pinned section stutters on engage | Pin engages one frame late | `anticipatePin: 1` |
| Distances wrong on resize or on a phone | Measured once at load | Functional values + `invalidateOnRefresh: true` |
| Right on reload, wrong on first visit | Measured before the webface swapped | `document.fonts.ready.then(ScrollTrigger.refresh)` |
| Page grows taller every navigation | Contexts never reverted, spacers accumulating | `ctx.revert()` on unmount |
| Scrubbed element lags a second behind the thumb | A CSS `transition` on a property GSAP writes every frame | Remove the transition. GSAP owns that property now |
| Two effects on one element, one of them dead | A `data-m` CSS animation and a `data-g` tween on the same transform | Pick one tier per element. `MotionGSAP.init` warns about this |
| Triggers all fire at the top of the page | Created before layout settled, or inside a `display: none` ancestor | Create after mount, then `ScrollTrigger.refresh()` |
| Ease looks generic despite a real bezier string | `cubic-bezier(...)` passed without CustomEase — silent fallback | §4 |

---

## 9. Verify

```bash
node scripts/test-gsap.mjs            # 33 assertions over runtime/motion-gsap.js
node scripts/motion-audit.mjs <url>
node scripts/motion-audit.mjs <url> --mobile
```

With GSAP on the page the audit adds: measured gzipped GSAP weight and the plugin list, untriggered tweens playing at load, pins missing `anticipatePin`, `scrub: true`, pin-spacer leaks, smooth-scroll hijacking, and whether any pin survives `prefers-reduced-motion`.

**A clean audit is not a good set-piece.** Whether the thing means anything is `design/references/award-bar.md` §2 axis 4, and that is a judgement you make by scrolling it on a real phone.
