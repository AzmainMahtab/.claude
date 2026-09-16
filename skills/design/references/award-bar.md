# The Award Bar

What separates a site that wins something from a site that is merely competent. Competent is: consistent tokens, passing contrast, sensible responsive, nothing broken. That is the floor this workspace already enforces, and it is not what gets recognised.

The gap is almost never polish. It is **commitment**. Competent work makes safe choices in every direction at once and averages out to nothing memorable.

---

## 1. The one-sentence test

> **A visitor should be able to describe the site to a friend in one sentence that is not about a feature.**

"It's the one where the whole page goes white and says one thing." "It's the one where the letters follow your cursor." "It's the one where the gym's queue empties as you scroll."

If the only sentence available is "it's clean and it works", the design has no idea in it. Find one before drawing anything. That sentence is the brief, and everything in the page either serves it or gets cut.

---

## 2. The six axes

Score each 0–3 while reviewing. Under 12 total is competent. 15+ is worth submitting anywhere.

### Idea (0–3)
- 0 — a layout with the brand's colours in it
- 1 — one nice section, the rest is scaffolding around it
- 2 — a clear concept, carried through most of the page
- 3 — one idea the whole page is an argument for, and nothing on the page contradicts it

### Typographic range (0–3)
Measured, not felt. Run the teardown on your own build and compare.
- 0 — everything between 16 and 40px
- 1 — a hero that is 3× body
- 2 — 5×+ with deliberate tracking and line-height per step
- 3 — the scale itself is doing the storytelling: a word at 12vw next to a caption at 11px, and both are correct

Tracking tightens as size grows. Line-height loosens as size shrinks. A display face at 6rem on default tracking is the single most common tell of an undesigned page.

### Spatial depth (0–3)
- 0 — a flat stack of full-width bands
- 1 — a container and some images
- 2 — real layering: overlap, differential movement, foreground crossing subject
- 3 — depth is structural. The page has a near, a middle and a far, and they behave differently

Depth comes from five tools used together: shadow with real offset, a 1px edge highlight, scale and blur as distance, **overlap** (the most underused and the cheapest), and grain on flat grounds so they do not band.

### Motion choreography (0–3)
See `motion.md`.
- 0 — nothing, or everything fades the same way
- 1 — entrances on a consistent curve
- 2 — motion with distinct jobs: orient, reveal, confirm
- 3 — one signature move nobody else has, plus a coherent curve vocabulary, plus a designed reduced-motion state

### Restraint (0–3)
The hardest to score because it is measured in absence.
- 0 — every effect available is present
- 1 — one accent, some discipline
- 2 — you can name three things they deliberately did not do
- 3 — the page is mostly empty and the emptiness is clearly load-bearing

Whitespace is the luxury signal. When a band feels cheap the answer is almost always more space, not another element.

### Craft detail (0–3)
- 0 — default focus rings, default selection colour, scrollbar untouched
- 1 — hover states everywhere, focus visible
- 2 — selection colour, caret, scrollbar, underline offset and thickness, tabular numerals in anything that tabulates
- 3 — the above plus optical corrections: the headline that is nudged 2px because it looks wrong at the mathematically correct position

---

## 3. Rhythm: the failure that hides best

**No two adjacent bands may behave the same way.** This is the difference between a page and a list.

A page with rhythm alternates deliberately:

```
full-bleed image  →  tight editorial column  →  lateral rail  →
quiet oversized type  →  dense data band  →  colour block close
```

A page without it:

```
heading + 3 cards  →  heading + 3 cards  →  heading + 3 cards  →  heading + 3 cards
```

Both can pass every accessibility and performance check. Only one is designed. When you cannot vary the layout, vary the **ground**: a hard cut between a light and a dark band resets the eye more effectively than any amount of decoration.

---

## 4. The peak

Every page needs exactly one moment that is bigger than the rest, and it needs to be engineered:

- **It gets the most room.** The most scroll length, the most whitespace, the largest type, or all three, by a visible margin.
- **The band before it is quieter than it is.** Contrast is what makes a peak land; a loud page has no peak because everything is loud.
- **It is the thing in the one-sentence test.**
- **The silence around it is authored.** Write it down as authored silence so a later review does not read it as a gap and fill it.

Three competing peaks is the same as none.

---

## 5. The close

An ending that trails off into a footer throws away the last thing the visitor feels. The close should **resolve and hold**: a colour block, an empty state, a single line at scale, a real input. Whatever it is, it should be the second-most-deliberate screen on the page.

---

## 6. Anti-slop, specifically

These are category defaults, not bans on principle. The brief can earn any of them. Reaching for one when nobody decided means you were not designing.

**Structure**
- A grid of identical icon + heading + text cards as the page's structure. The most recognisable machine-made tell there is.
- Three equal feature columns. Nested cards. More than two consecutive image-left/text-right zigzags.
- The hero-metric template: big number, small label, three supporting stats.
- A split header with a giant headline left and a small floating paragraph right.

**Labels**
- An eyebrow above every heading. One per three sections at most.
- `01 / 06` section counters, unless the sequence is information the reader needs.
- "Scroll", "↓ scroll to explore", animated mouse icons. They are looking at the hero. They know.
- Decorative text strips (`BRAND. MOTION. SPATIAL.`) across the hero bottom.

**Surface**
- Gradient text. Neon glow. Zero-offset coloured halo shadows.
- Violet-to-blue AI gradients, and the cream-and-brass artisan palette. Both are what a page reaches for when nobody chose.
- Glass and blur as decoration rather than as a specific effect.
- Custom cursors. Emoji standing in for an icon system.

**Content**
- Em dash anywhere visible. Use a period, comma, colon or parentheses.
- Lorem ipsum, "John Doe", and invented statistics. Fake precision (`4.1×`, `92%`) is a credibility liability, not a design element. No real number, no counter.
- Filler verbs: elevate, seamless, unleash, next-gen, supercharge, revolutionize.
- Div-built fake dashboards and fake terminals. If a surface cannot actually compute, do not paint one.

---

## 7. The squint test

Blur the page until detail is gone. You should still be able to name the primary element, the secondary element and the major groups, in that order.

If everything greys into one even field, the problem is hierarchy, and no amount of shadow, gradient or motion will fix it. Go back to type scale, weight and space.

---

## 8. Before you call it done

- [ ] The one-sentence test has an answer, and it is about an experience.
- [ ] Six axes scored, total written down, nothing below 2.
- [ ] No two adjacent bands behave the same way.
- [ ] Exactly one peak, with the most room and a quieter band before it.
- [ ] The close resolves and holds.
- [ ] Motion table in the page spec, one row per move, with curves and a reduced-motion column.
- [ ] Teardown run against **your own build**, and the type scale, spacing base and contrast pairs match the guidelines. If your own numbers surprise you, the system drifted during the build.
- [ ] Anti-slop pass, honestly.
