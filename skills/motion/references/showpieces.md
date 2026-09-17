# Showpieces

The tier 2 vocabulary. Every device here is a moment a page is partly built around — the thing a visitor would describe to someone else. If a page has more than **one** of them, it has none, because none of them is the moment.

Read `gsap.md` first for what this tier costs and when it is the wrong answer.

**Coverage.** ✅ is on `demo/gsap.html` and asserted by `scripts/test-gsap.mjs`. ○ is written from the same rules but hand-authored per page — which is what a signature move is.

Everything marked ✅ is driven by a `data-g` attribute and needs no page JavaScript beyond `MotionGSAP.init()`.

---

## Entrances

### ✅ The headline that assembles — `chop`

```html
<h2 data-g="chop" data-g-chop="lines">
  Each line rises from behind its own edge, and the block assembles as one gesture.
</h2>
```

Lines rise from behind their own mask with the next starting **before** the one above lands. The overlap is the whole point: a stagger with no overlap is four separate events, this is one gesture.

`data-g-chop="words"` for a short punch line. Characters are available in SplitText and deliberately not wired up here — 48 spans is 48 things a screen reader has to get through, and per-character reading turns a headline into a loading bar.

- **Cost** 3.7KB (SplitText), or 0 extra — the runtime falls back to a measuring word splitter.
- **Reduced motion** all units painted, no tween.
- **At load** if it is on the first screen it is painted, not animated. Opt in with `data-g-at-load="animate"`.
- **Wrong when** the headline is longer than three lines. Past that the assembly outlasts the reader's patience.

### ✅ Batched reveals — `reveal`, `data-g-stagger`

```html
<p data-g="reveal">One trigger, fires once, never re-hides.</p>

<div class="grid" data-g-stagger="60">
  <article>…</article><article>…</article><article>…</article>
</div>
```

`ScrollTrigger.batch` means a twelve-card grid costs **one** trigger, not twelve. Capped at 8 in the stagger, same as the CSS tier: past that the tail arrives late enough to read as broken.

- **Cost** 0 beyond ScrollTrigger, which you are already paying for.
- **Honestly:** if reveals are *all* the page needs, you are on the wrong tier. `data-m="reveal"` does this for 0 bytes.

---

## Scroll as a playhead

### ✅ The pinned sequence — `pin`

```html
<section data-g="pin" data-g-hold="90">
  <div data-g-stage>
    <div data-g-step><h2>The frame holds</h2><p>…</p></div>
    <div data-g-step><h2>The content advances</h2><p>…</p></div>
    <div data-g-step><h2>Then it releases</h2><p>…</p></div>
  </div>
</section>
```

The frame is held while the content advances against it. **The scroll rate is untouched** — the wheel keeps doing its normal job the whole way, which is the line between pinning (fine) and scroll-jacking (not).

`data-g-hold` is viewport-heights per step. 90 is a brisk read; 140 lingers.

- **Cost** 0 beyond ScrollTrigger.
- **Reduced motion** no pin at all. The steps become a normal stacked read in source order.
- **Wrong when** the content is the page's main argument. A pinned section cannot be skimmed, so use it for a demonstration, never for the paragraph that says what you do.

### ✅ The horizontal rail — `rail`

```html
<section data-g="rail">
  <div data-g-track>
    <article>…</article><article>…</article><article>…</article>
  </div>
</section>
```

Lateral travel reads as **range** or **options**; vertical reads as **argument**. That is the entire basis for choosing it.

Travel is `scrollWidth − offsetWidth`, recomputed on every refresh, so it survives a resize and a font swap. A hardcoded `x` is wrong the moment either happens.

- **Cost** 0 beyond ScrollTrigger.
- **Reduced motion** becomes a real `overflow-x: auto` container — same content, same order, still keyboard-reachable.
- **Wrong when** the cards carry long copy. Reading horizontally while scrolling vertically is a strange thing to ask of anyone.

### ✅ The card stack — `stack`

```html
<section data-g="stack" data-g-top="72" data-g-offset="12">
  <article data-g-card>…</article>
  <article data-g-card>…</article>
  <article data-g-card>…</article>
</section>
```

Each card sticks, the next covers it, and the one below scales back and dims so it reads as *further away* rather than as gone. `sticky` does the holding; GSAP only does the depth.

- **Cost** 0 beyond ScrollTrigger. One trigger per card.
- **Reduced motion** a plain stacked list.

### ✅ The scrubbed scene — `scrub`

```html
<section data-g="scrub" data-g-catch="1">
  <div class="sticky">
    <div data-g-scrub-item data-g-from-x="-320" data-g-to-x="320">SCRUBBED</div>
  </div>
</section>
```

Per-item `data-g-from-*` / `data-g-to-*` for `x`, `y`, `scale`, `rotate`, all on one timeline at position 0, all `ease: 'none'`. A scrubbed tween with an ease fights the reader's hand.

`data-g-catch` is the catch-up in seconds. `1` reads as weight; `0` is glued to trackpad jitter.

### ✅ The self-drawing diagram — `draw`

```html
<svg viewBox="0 0 600 160" data-g="draw" aria-hidden="true">
  <path d="M10 130 C 120 130, 140 20, 240 20 S 380 140, 480 60 L 590 60"/>
</svg>
```

DrawSVGPlugin when registered, `getTotalLength()` and a dasharray when not — the same effect for **0 extra bytes**, on any `path`, `line`, `polyline`, `circle`, `rect` or `ellipse`.

The strongest version is not decorative: draw the thing you are explaining, then the dimension lines, then the callouts, each as a step.

- **Wrong when** the SVG is a logo. A logo that draws itself on every visit is a load screen.

---

## Layout

### ✅ Layout change as a movement — `flip`

The one device here with **no CSS equivalent at all**. Filtering a grid normally teleports every surviving card to a new slot.

```js
MotionGSAP.flip(grid.children, () => {
  [...grid.children].forEach((t) => {
    t.style.display = (f === 'all' || t.dataset.cat === f) ? '' : 'none';
  });
});
```

It is a method rather than an attribute because the DOM change is yours: Flip records the first layout, you change whatever you like, and it animates the difference.

The other use, and the better one: a card that **expands into a detail view**. Same element, same photo, one continuous movement instead of a modal appearing over the top.

- **Cost** 9.7KB.
- **Reduced motion** the mutation happens with no tween.

---

## Pointer

### ✅ Magnetic CTA — `magnet`

```html
<a class="btn" href="/book" data-g="magnet" data-g-strength="0.34">Book a walkthrough</a>
```

`gsap.quickTo` means **GSAP's single ticker owns it** — no rAF loop of this device's own, which is the "one owner" rule tier 1 has to enforce by hand.

- **Cost** 0. `quickTo` is core; InertiaPlugin is not needed for this.
- **Gated** to `(hover: hover) and (pointer: fine)`, off under reduced motion.
- **Primary CTA only.** A page of magnetic elements is unusable.

### ✅ The pointer-carried reveal — `mask`

```html
<div class="maskbox" data-g="mask" data-g-radius="150">
  <div class="layer under">BEFORE</div>
  <div class="layer over" data-g-mask-layer>AFTER</div>
</div>
```

Two stacked compositions, the top one clipped to a circle under the cursor. Before/after, day/night, wireframe/rendered — anything where the comparison *is* the content.

- **Cost** 0. Uses `quickSetter`, so the clip write is batched by the ticker.
- **No pointer** the top layer is shown outright, rather than leaving half the composition permanently unreachable.

---

## Ambient

### ✅ Velocity skew — `skew`

```html
<section data-g="skew"> … </section>
```

The page leans into its own scroll velocity. **Six degrees at full tilt.** Fifteen reads as a broken page. Clamped, and it returns to 0 at rest — without the idle reset a fast flick leaves the layout permanently crooked, which is the classic version of this bug.

- **Wrong when** applied to body copy. The reader should not be tracking a moving target.

### ✅ Counters — `counter`

```html
<b data-g="counter">3,000</b>
```

The target is read from the element's **own rendered text**, so the DOM is correct before any script runs, correct if none ever does, and correct for a crawler and a reduced-motion reader. Formatting — commas, prefix, suffix, decimals — is inferred from what is already there, and `snap` keeps it on whole units.

**Real numbers or no counter.** A counter with an invented figure is a credibility liability, not a flourish.

---

## Signature moves — hand-authored, ○

The kit is vocabulary. The thing someone describes to a friend is **one bespoke interaction that exists on this site alone**. A recoloured kit device is not it.

### ○ The scrubbed frame sequence

The single most expensive-looking effect on the web, and it is a `<canvas>` and an array of JPEGs.

```js
const frames = Array.from({ length: 90 }, (_, i) =>
  `/seq/${String(i + 1).padStart(3, '0')}.avif`);
const images = frames.map((src) => Object.assign(new Image(), { src }));
const ctx = canvas.getContext('2d');
const state = { f: 0 };

const draw = () => {
  const img = images[Math.round(state.f)];
  if (img?.complete) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};
images[0].onload = draw;

gsap.to(state, {
  f: frames.length - 1,
  ease: 'none',
  scrollTrigger: { trigger: section, start: 'top top', end: '+=300%', scrub: 0.5, pin: true },
  onUpdate: draw,
});
```

Budget it honestly: 90 AVIF frames at 1280px is 1.5–3MB. That is a real cost and it must be `preload`ed behind the fold, decoded off the main thread, and dropped entirely on a slow connection (`navigator.connection?.saveData`). Under reduced motion, draw frame 0 and skip the pin.

### ○ The morph

```js
gsap.to('#shape', {
  morphSVG: '#target',
  duration: 0.9,
  ease: bezier(0.2, 0.8, 0.2, 1),
  scrollTrigger: { trigger: section, start: 'top 60%', once: true },
});
```

9.6KB, and worth it only when one thing **genuinely becomes** another — a logo into a play button, a map pin into a location card. A morph between two unrelated shapes is a screensaver.

### ○ The velocity marquee

A ticker that speeds up, slows down and **reverses** with the scroll direction. The reversal is what makes it read as a physical object rather than a CSS loop.

```js
const loop = gsap.to(items, {
  xPercent: -100, ease: 'none', duration: 12,
  repeat: -1, modifiers: { xPercent: gsap.utils.wrap(-100, 0) },
});
ScrollTrigger.create({
  onUpdate: (self) => {
    loop.timeScale(gsap.utils.clamp(-3, 3, self.getVelocity() / 260) || 1);
  },
});
```

Content written twice, the second copy `aria-hidden`. Under reduced motion it becomes a static, horizontally scrollable strip — it is content, so it stays readable.

### ○ The overlay that hands off to the hero

A load overlay is almost always a tax on the reader. It earns its place only when it **hands something to the page** — the wordmark in the centre travels to its resting place in the header, and the page is already painted underneath.

```js
const tl = gsap.timeline();
tl.to('.overlay-mark', { ...Flip.fit('.overlay-mark', '.header-mark'), duration: 0.8, ease: easeOut })
  .to('.overlay', { autoAlpha: 0, duration: 0.3 }, '-=0.2');
```

Hard rules: under 900ms total, skippable by any input, and **never** on a repeat visit — `sessionStorage` and it is gone. Under reduced motion it does not exist at all.

### ○ The band that inverts what passes behind it

A fixed strip using `mix-blend-mode: difference`, opening with scroll velocity and closing at rest. Costs almost nothing, works on any content, and is unmistakably not a template.

Check it on a real phone before promising it: full-screen `mix-blend-mode` and large `backdrop-filter` are the two things that are fine on a desktop and terrible on a device.

---

## The bar

Before any of this ships, the questions from `design/references/award-bar.md` §2:

- Can you say what this move is **for** in one sentence that is not "it looks nice"?
- Is it the **only** set-piece on the page?
- Does the page still make its argument with JavaScript disabled?
- Does the reduced-motion branch build a genuinely simpler thing, rather than a crippled version of the complex one?
- Have you scrolled it on a real phone, in Low Power Mode?

A clean `motion-audit.mjs` answers none of those. It checks mechanics.
