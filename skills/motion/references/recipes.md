# Recipes

Copy-paste patterns for the moves that hold attention. Each one says what job it does, because a move doing no job gets deleted.

**Coverage.** Recipes marked ✅ are on `demo/index.html` and asserted by `scripts/test-runtime.mjs`. Those marked ○ are standard patterns written from the same rules but not in the fixture — verify them in your own build with `scripts/motion-audit.mjs` before shipping.

---

## Entrances

### ✅ Reveal — the default, and usually enough

```html
<h2 data-m="reveal">Arrives as it enters</h2>
<p data-m="reveal">Opacity plus a 16px rise. A fade with no travel reads as a loading glitch.</p>
```

### ✅ Stagger — the eye led down the stack in reading order

```html
<div class="grid" data-m-stagger="60">
  <article>…</article>
  <article>…</article>
  <article>…</article>
</div>
```

30–80ms. Capped at 8 children by the CSS, deliberately: past that the tail arrives late enough to read as broken. Long lists reveal as a whole, or in row groups of four.

### ✅ The headline that assembles

```html
<h1 data-m-split="lines">Motion that earns its place, and nothing that does not.</h1>
```

Lines are almost always right. `words` for a short punch line. Characters are not offered: splitting per character turns reading into waiting. Each unit rises from behind a mask with room reserved for descenders, because clipping to the line box shears the tails off g, y, p and j.

Needs tier 1, and it re-runs after `document.fonts.ready` — line boxes cannot be measured before the face has loaded.

---

## Media

### ✅ The wipe — a change of state, not an introduction

```html
<figure data-m="clip">
  <img src="/hero.avif" width="1600" height="900" alt="…">
</figure>
```

Use it **big**. Edge to edge across a full-bleed image it is a transition; on a 200px thumbnail it is a fidget.

### ✅ The push-in

```html
<figure class="plate" data-m="push">
  <img src="/floor.avif" width="1600" height="1000" alt="…">
</figure>
```

`scale(1.08) → scale(1)` scrubbed across the element's travel. The only zoom that is not a gimmick, because the hand is driving it rather than it playing at the reader. The frame needs `overflow: hidden`.

### ✅ Parallax planes

```html
<div class="layers">
  <img class="far"  data-m="parallax" data-m-rate="1.4" src="…" alt="">
  <img class="mid"  data-m="parallax" data-m-rate="0.9" src="…" alt="">
  <img class="near" data-m="parallax" data-m-rate="0.4" src="…" alt="">
</div>
```

Rate is in hundreds of pixels across the whole travel, so it is independent of screen height. **Adjacent planes differ by 10–30%.** More and it stops reading as distance and starts reading as things sliding around. Copy always rides at 1×, and never on a plane.

Three traps that each cost a round of fixes:

- A global `img { max-width: 100% }` shrinks an absolutely positioned plane to the viewport on phones, so the far plane never shows. Planes carry `max-width: none` and a fixed width.
- A `transition: transform` on a plane eases every per-frame write over its duration, which on a phone reads as the plane lagging a second behind the thumb. Parallaxed elements transition opacity only.
- Replacing a plane's art under the same filename ships nothing to a device holding the old bytes. New art gets a new name.

---

## Scroll-linked

### ✅ The scrubbed scene — the workhorse

A section that publishes `--m-p` from 0 to 1 across its own travel. Everything inside reads it with `calc()`, in plain CSS, with no JavaScript.

```html
<section class="scene" data-m="scene">
  <div class="stage">
    <h2 class="mover">SCRUBBED BY THE HAND</h2>
  </div>
</section>
```

```css
.scene  { height: 260vh; }                 /* the travel */
.stage  { position: sticky; top: 0; height: 100vh;
          display: grid; place-items: center; overflow: hidden; }
.mover  { transform: translate3d(calc(var(--m-p) * -36vw), 0, 0); }
```

The sticky stage holds the frame while the content advances. Anything can read `--m-p`: rotation, opacity, `clip-path`, a counter's width, a colour mix.

**No transition on anything driven by `--m-p`.** It is written continuously; a transition would restart every frame and never arrive.

### ○ Horizontal travel from vertical scroll

Lateral movement reads as *breadth* where vertical reads as *argument*. Right for a range, a lineup, a timeline. Wrong for a hierarchy: the first item in a rail is not read as the most important.

```html
<section class="rail-scene" data-m="scene">
  <div class="stage">
    <div class="rail">
      <article>…</article><article>…</article><article>…</article><article>…</article>
    </div>
  </div>
</section>
```

```css
.rail-scene { height: 300vh; }             /* ≈ 1vh per item, plus one */
.rail { display: flex; gap: 1.5rem; width: max-content;
        transform: translate3d(calc(var(--m-p) * (100vw - 100%)), 0, 0); }

@media (prefers-reduced-motion: reduce) {
  .rail-scene { height: auto; }
  .stage { position: static; height: auto; }
  .rail  { transform: none; overflow-x: auto; scroll-snap-type: x proximity; }
}
```

**Measure the overflow, do not assume it.** If the rail is narrower than the viewport the travel is zero and the reader turns the wheel through three screens of nothing. It is width-dependent, so it can be correct on a phone and dead on a desktop at the same time:

```js
document.querySelector('.rail').scrollWidth - innerWidth   // want a healthy positive number
```

If three items do not reach half a viewport of overflow, the fix is not wider cards, it is **more rail**: put the section heading in as the first item and a closing note as the last.

### ○ Cards that stack

```html
<div class="stack">
  <article class="card" style="--n:0">…</article>
  <article class="card" style="--n:1">…</article>
  <article class="card" style="--n:2">…</article>
</div>
```

```css
.card { position: sticky; top: calc(4rem + var(--n) * 1.5rem); }
```

Pure CSS, no scroll listener, no JS. Each card parks a little lower than the last, so the deck builds as you scroll. Give the cards an opaque background or they read as a mess.

### ✅ The progress trace

```html
<div class="bar" data-m="progress" aria-hidden="true"></div>
```

```css
.bar { position: fixed; inset: 0 0 auto 0; height: 3px;
       background: var(--ink); z-index: 9; }
```

Scales X against document scroll. `aria-hidden` because it is decorative: a screen reader user has a better position indicator already.

---

## Attention

### ✅ The counter

```html
<b data-m="count" data-m-count="1,240">0</b> members
<b data-m="count" data-m-count="4.8">0</b> rating
```

Write the target exactly as it should render, commas included. Formatting is inferred: decimals from the decimal places, grouping from the comma or from a target over 10,000. Fires once at half visibility, eases out hard so most of the distance goes early and the last digits settle, and writes the final value immediately under reduced motion.

**Real numbers only.** A counter is a truth claim with motion attached, which is what makes it persuasive and an invented one a liability. No verified figure, no counter.

### ✅ The marquee

```html
<div class="marq" data-m="marquee">
  <div><span>ZERO JAVASCRIPT</span><span>/</span><span>SCROLL DRIVEN</span><span>/</span></div>
  <div aria-hidden="true"><span>ZERO JAVASCRIPT</span><span>/</span><span>SCROLL DRIVEN</span><span>/</span></div>
</div>
```

**Write the content twice**, second copy `aria-hidden`, so translating exactly `-50%` loops seamlessly with no JavaScript. Continuous, so `linear` is correct here and nowhere else. Pauses on hover, becomes a static scrollable strip under reduced motion. Set `--m-marquee-dur` (default 38s) and `--m-marquee-gap`.

### ✅ Pointer response

```html
<a class="cta" data-m="magnet" data-m-strength="0.3">Book a walkthrough</a>
<div class="card" data-m="tilt" data-m-deg="7">…</div>
<section class="lit" data-m="spot">…</section>
```

```css
.lit::after {                       /* a light that follows the pointer */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(240px at calc(var(--m-mx,.5)*100%) calc(var(--m-my,.5)*100%),
              rgba(255,255,255,.16), transparent 70%);
}
```

All three interpolate toward the pointer rather than tracking it directly: direct tracking carries no momentum and reads as artificial. Gated to `(hover: hover) and (pointer: fine)` so touch never fires a false hover, and off entirely under reduced motion.

**Magnet on the primary CTA only.** A page of magnetic elements is unusable. Tilt 5–9 degrees; past 12 it is a toy.

### ✅ State feedback

```html
<a class="btn" data-m-press data-m-hover>Press me</a>
<a href="#" data-m="underline">Draws from the leading edge</a>
```

The cheapest craft signal on any page, and the one most often skipped. Every interactive element gets hover, focus-visible, active and disabled. A page with only the resting state is half-built.

---

## Between pages

### ○ View transitions, zero JS

```html
<meta name="view-transition" content="same-origin">
```

```css
@view-transition { navigation: auto; }

::view-transition-old(root) { animation: m-fade 180ms var(--m-std) reverse; }
::view-transition-new(root) { animation: m-fade 320ms var(--m-out); }

@media (prefers-reduced-motion: reduce) {
  @view-transition { navigation: none; }
}
```

Astro has this built in via `<ClientRouter />`, but the CSS-only form above needs no island at all. Name a shared element on both pages with `view-transition-name` and it morphs between them, which is the single most impressive thing available for zero bytes.

Keep it under 350ms. A page transition the reader waits for is a page transition they resent.

---

## The signature move

Everything above is vocabulary. The thing a visitor describes to a friend is **one bespoke interaction that exists on this site alone**, authored in the page, driven off `--m-p` or your own listener.

What counts:

- Scroll as a playhead over a persistent trace that stamps a marker each time you pass a section, so the footer arrives with a record of what you just read.
- A wordmark the pointer can pull apart, which settles back to exact lockup on release.
- An SVG that draws itself: `stroke-dashoffset` from `--m-p`, then the dimension lines, then the callouts.
- One control that re-grades the whole page at once — a time of day, a load level — where every ground, image and accent shifts together.
- A fixed band that inverts whatever passes behind it, opening with scroll velocity and closing at rest.

What does not count: a kit device with a different parameter. A recoloured spotlight, `tilt="9"` instead of `6`, a third scrubbed scene, the rail scrolling the other way. **Describe it to someone who has seen the other builds. If they cannot tell it apart from something the kit already does, it is not a signature move.**

One per page. Three delightful moments is zero, because none of them is the moment.
