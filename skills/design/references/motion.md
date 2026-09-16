# Motion

Most sites that miss award level miss it here. The type is fine, the palette is fine, and then everything fades up by 20px on a 600ms `ease` and the page reads as a template with a plugin on it.

Motion is **choreography**: a small number of deliberate moves, on one curve vocabulary, each doing a job. It is not a property you add to sections.

Design it at design time. A page spec that says "sections fade in" has not specified anything, and the build will improvise.

---

## 1. The four jobs

Every piece of motion on a page should be doing one of these. If it is doing none, delete it.

| Job | What it looks like | Budget |
|---|---|---|
| **Orient** | The nav re-grounds as the page changes; a progress trace fills; a sticky label updates | Continuous, subtle, never draws attention to itself |
| **Reveal hierarchy** | Content arrives in reading order, so the eye is led rather than presented | Once per band, on entry only |
| **Confirm** | Hover, focus, press, toggle. The interface answering | 100–180ms, every interactive element |
| **Delight, once** | The one thing they remember and describe to someone else | Exactly one per page |

The fourth is what separates the memorable from the merely smooth, and the rule is **once**. Three delightful moments is zero, because none of them is the moment.

---

## 2. Easing is the fingerprint

The curve carries more character than the duration does. Pick a vocabulary of **two or three curves for the whole site** and hold it. A page with nine different easings feels arbitrary even when no individual choice is wrong.

| Name | Value | Feel | Use for |
|---|---|---|---|
| **Expo out** | `cubic-bezier(0.23, 1, 0.32, 1)` | Arrives fast, settles long | The house entrance curve. Reveals, page transitions, anything travelling a distance |
| **Quint out** | `cubic-bezier(0.22, 1, 0.36, 1)` | Slightly softer than expo | Interchangeable with the above; pick one, not both |
| **Standard** | `cubic-bezier(0.4, 0, 0.2, 1)` | Even, neutral, unobtrusive | State changes where you do not want personality. Material's curve |
| **Out quad** | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Gentle | Small UI, hover, focus |
| **Back out** | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoots and settles | One playful element, at most. Never on text |
| **Linear** | `linear` | No acceleration | Only for continuous loops: marquees, spinners, scroll-linked values |

Rules that hold regardless of taste:

- **Never `ease-in` on anything entering.** It delays the moment the eye is already waiting for. `ease-out` at 200ms feels faster than `ease-in` at 200ms.
- **The browser defaults are weak.** `ease`, `ease-out` and `ease-in-out` are flat compared to the curves above. Using them is usually a sign nobody chose.
- **Exits are faster than entrances.** Roughly 0.6× the duration. Things should leave quickly and arrive with weight.
- **Scroll-linked values take no easing at all.** The hand is the easing. Adding a transition to a per-frame scroll write restarts it every frame and it never arrives.

---

## 3. The duration ladder

Duration scales with distance travelled and with the size of the thing moving. One value for everything is the second-most-common tell after default easings.

| Move | Duration |
|---|---|
| Hover, focus ring, colour change | 120–180ms |
| Press feedback | 90–120ms |
| Small element entering (a chip, an icon, a row) | 300–400ms |
| A band of content entering | 500–700ms |
| A full-screen state change or page transition | 600–900ms |
| Ambient loop (marquee, gradient drift) | 20–60s, `linear` |

Anything over 1s that is not a loop is the page talking over the visitor. Anything under 80s… under 80**ms** is invisible and should be instant instead.

---

## 4. Stagger is how you direct the eye

A group that animates together is a block appearing. A group that animates in sequence is a sentence being read.

- **30–80ms between siblings.** Under 30 reads as simultaneous; over 80 and the reader outruns it and starts scrolling past the tail.
- **Stagger in reading order**, always. Left to right, top to bottom. A grid that staggers diagonally looks clever once and wrong every time after.
- **Cap the chain at about 8 items.** Past that the last item arrives so late it reads as broken. Long lists reveal as a whole, or in row groups.
- **Never stagger characters in a headline.** Word-level for a short punch line, line-level for anything longer. Character splitting turns reading into waiting.

---

## 5. Entrance motion, and when to skip it

The default should be **less than you think**, and the hero should be **none**.

- **Nothing animates the hero.** Not the headline, not the image, not the CTA. It delays the largest paint, it is measurable in the performance score, and the first screen is the one moment you have the visitor's full attention without needing to earn it.
- **Fire once, on entry.** Content that re-hides when the reader scrolls back up is a defect, not an effect. Use an IntersectionObserver that unobserves after firing.
- **Trigger inside the viewport**, about 12% up from the bottom edge, so it fires when the reader is looking rather than when the first pixel clears the fold.
- **A fade with no movement reads as a loading glitch.** Pair opacity with a 12–18px rise. Past 24px it reads as a slide, which is a different and louder effect.
- **Never `scale(0)`.** Enter from `scale(0.96)`. Nothing in the physical world appears from nothing.

---

## 6. Scroll-linked motion

The strongest and the most dangerous category. Done well it is the whole reason a site wins anything; done badly it is the reason a site is unusable on a phone.

- **The hand is the clock.** A scroll-linked value must track scroll position exactly, with smoothing applied to the *value*, not via a CSS transition.
- **Smooth the value, not the property.** Lerp toward a target in a rAF loop at a fixed fraction per frame (0.1–0.2 is the usable range). Wheel events do not arrive at a constant rate, and a 1:1 write reproduces every gap in them as stutter.
- **One owner per value.** If two loops both compute velocity or both advance a `lastY`, one of them will consume the delta and the effect silently dies.
- **Never scroll-jack.** Hijacking the wheel to force a fixed pace fails for keyboard, trackpad, screen reader and anyone in a hurry. Pinning is fine; overriding the scroll rate is not.
- **Parallax rates differ by 10–30% between adjacent planes.** More than that stops reading as distance and starts reading as things sliding around. Copy always travels at 1×.
- **Text never rides a parallax layer.** The reader should not be tracking a moving target.

---

## 7. `prefers-reduced-motion` is a design state, not a kill switch

Reduced motion means **fewer and gentler, not zero**. Stripping all motion often strips the meaning with it.

- Keep the opacity that carries comprehension. Drop every position change.
- Keep scroll-linked *navigation* working. A horizontal rail that only moves by transform becomes unreachable if you zero it; turn it into a native `overflow-x: auto` region instead.
- The static composition must be complete on its own. If a layout only makes sense once something has moved, the layout is the problem.
- Say in the page spec what the reduced state is. It is a state you designed, not a fallback the build improvises.

---

## 8. Performance rules that are not negotiable

- **`transform` and `opacity` only** for anything continuous. `clip-path` is the sanctioned third, for wipes.
- **Never animate `width`, `height`, `top`, `left`, `margin` or `padding`**, and never `transition: all`. They lay out every frame.
- **Never write a transitioned property every frame.** The transition restarts on each write and the value never arrives. This is the most common scroll-animation bug and it looks like "the effect does not work" rather than like a timing error.
- **`will-change` is a loan, not a decoration.** Set it on the handful of elements that genuinely animate; a page covered in it exhausts compositor memory and gets slower.
- **Pause offscreen work.** An ambient loop running in a tab nobody is looking at is a battery bug.

---

## 9. Specify it, or it will be improvised

Motion belongs in the page spec next to the responsive table. Minimum per page:

```markdown
### Motion

| Element | Trigger | Move | Duration | Curve | Reduced-motion state |
|---|---|---|---|---|---|
| Section headings | Entry, once, -12% margin | opacity 0→1, y +16px→0 | 620ms | expo out | opacity only |
| Grid items | Entry, staggered 60ms, max 8 | opacity 0→1, y +14px→0 | 500ms | expo out | all visible, no stagger |
| Nav ground | Scroll, continuous | background + colour swap at band boundaries | 420ms | standard | instant swap |
| Primary CTA | Hover / focus | background + colour invert | 160ms | out quad | unchanged |
| <the one signature move> | <trigger> | <what it does> | <timing> | <curve> | <state> |

**Nothing animates the hero.**
**Signature moment:** one sentence on what it is and why it is the thing they remember.
```

If the table has one row per section and they are all identical, you have not choreographed anything: you have applied a plugin. Go back to §1 and work out what each move is *for*.
