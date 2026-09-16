# Reading a Reference Website

When someone says "make it like *site*", they are pointing at an effect, not asking for a copy. The job is to find the decisions producing that effect and keep the ones that fit this project.

Two failures to avoid, and they are opposite:

- **Skimming a screenshot and imitating.** Reproduces the surface (colours, round corners) and misses the structure, which is where the quality lives.
- **Guessing at the mechanics.** "It probably uses GSAP" and "the type scale looks like 1.25" are not findings. They get written into a design doc as fact and then the build chases a number nobody measured.

So: **measure first, judge second.** The measuring is automated. The judging is not.

---

## 1. Run the teardown

```bash
npm i playwright-core      # once
node <skill>/scripts/teardown.mjs https://example.com --out research/
node <skill>/scripts/teardown.mjs https://example.com --mobile
```

It loads the page in real Chrome, scrolls it end to end so lazy content and reveals commit, re-fetches every stylesheet, and reports what the site is **actually** made of:

| Block | What you get | Why it matters |
|---|---|---|
| Built with | Framework, animation libraries, generator, CDN/host headers, font host, count of CSS custom properties | Tells you whether the effect is a library you can also use, or bespoke code you have to author |
| Type | Families as rendered with character counts, loaded weights, the display and body specimens with line-height and tracking, the size ladder, the median ratio between steps, display-to-body multiple | This is the single most transferable thing on any reference, and the number nobody ever measures |
| Colour | Backgrounds ranked by **painted area**, and every ink/ground pair measured with a real contrast ratio and a pass/fail | Area-weighting is what tells you the 60/30/10 split. A palette list does not |
| Space & shape | The base unit (which of 4/5/8 divides most sampled values), the step ladder, container widths, grid column counts, radius and border histograms, shadow policy | Gives you their spacing scale rather than your impression of it |
| Motion | Duration histogram, easing histogram including raw `cubic-bezier` values, `@keyframes` count, whether `prefers-reduced-motion` is honoured, sticky/transformed/will-change counts, canvas/video/backdrop/blend usage | The easing curves are the fingerprint of the feel. Copy the curve, not the adjective |
| Structure & weight | Heading outline, image formats, bytes by resource type | Sets the performance conversation before you design something that cannot hit the budget |

`--out DIR` also writes the JSON and two screenshots, so the numbers are citable later.

### Trust the warnings

The tool prints **⚠ THIS READ IS NOT TRUSTWORTHY** when it has likely captured a bot wall, a consent gate or an unhydrated shell: an interstitial title, under 400 characters of body text, fewer than 8 requests, or a document barely one viewport tall. Cloudflare-fronted sites hit this constantly.

When you see it, the numbers are from a challenge page. Re-run with a longer `--wait`, try the other of `www`/apex, or read the site by hand. **Do not record them as findings.** A confident teardown of an interstitial is worse than no teardown, because it looks like evidence.

It also prints a floor warning when only a little CSS was readable. Inlined, CORS-blocked and JS-authored styles are invisible to it, so a low `CSS read` number means the motion vocabulary is incomplete, not absent.

---

## 2. Look at it, in the browser, with your own eyes

The tool cannot see the thing that makes a reference worth referencing. Open it and answer these by hand:

- **What is the one idea?** Every site worth copying has exactly one. Name it in a sentence. If you cannot, the site is competent rather than good, and it is the wrong reference.
- **Where does the eye land first, and what put it there?** Scale, contrast, isolation, or motion. Usually not colour.
- **What is the rhythm of the page?** Note the behaviour of each band in order. Award-level pages vary it; template pages repeat one band six times. See `award-bar.md`.
- **What happens on scroll that you did not expect?** The surprise is usually the signature move.
- **Where is it restrained?** What did they deliberately *not* do. This is the hardest thing to see and the most valuable thing to take.
- **Is the motion choreographed or sprinkled?** Does anything lead your eye somewhere, or do elements just fade in independently. See `motion.md`.

The `pencil` MCP `browser` tool opens the live site and can import a section onto the canvas, which is the fastest way to study a composition closely. `WebFetch` is still the quickest read of **content architecture**: section order, heading text, how much they say and where.

---

## 3. Write the findings as decisions

For every reference, a row. A row that cannot be written as a decision with a reason was a vibe, and vibes do not survive to implementation.

| Reference | Measured | Decision taken | Why it fits here |
|---|---|---|---|
| `astro.build` | 190 CSS custom properties; easing `cubic-bezier(.23,1,.32,1)` at 150–300ms | Token-driven with one expo-out curve for every entrance | Our build is also token-driven, and one curve across a whole site is what makes motion read as intentional |
| `studio-x.com` | Display 96px against 17px body, a 5.6× jump; single family, two weights | Hierarchy from scale alone, not colour or weight | Client's palette is two neutrals; scale is the only lever with that much range |
| `atelier-y.fr` | Two background tones by area, 78% / 19%; no shadows; radius 0 | Hairlines and ground changes instead of cards | The photography is the product and boxes compete with it |

Record the measurement next to the decision. Six months later that column is the difference between a design system and a folk memory.

### Synthesis, not selection

Take **structure** from one reference, **type behaviour** from another, **colour and detail** from the brand itself. Three references blended with judgement is a design. One reference recoloured is a copy: legally risky, creatively empty, and instantly obvious to the client who named it.

Then check the result against the brief. If the register the client asked for is not what these decisions produce, the references were wrong for this project. Say so and propose different ones rather than delivering a mismatch.

---

## 4. Reconcile with the performance budget

Reference sites are frequently slow, and a client admiring one is admiring how it looks, not how it loads. The teardown's weight block makes this concrete before you design something that cannot ship.

| Reference does | Cost | Substitute |
|---|---|---|
| Full-screen autoplay video hero | LCP, TBT, bandwidth | Poster still with `fetchpriority="high"`; motion moves below the fold |
| Scroll-triggered entrance on everything | CLS, TBT, delayed LCP | Entrances on the first screen only, or none; hero paints immediately |
| WebGL background, custom cursor | TBT, accessibility | Drop it, or gate behind `prefers-reduced-motion` and `pointer: fine` |
| Six web font weights (the tool prints the loaded list) | Multiple render-blocking requests | One variable font per family, two weights |
| Embedded interactive map | 300–600ms third-party main thread | Static image that loads the embed on click |
| A 1.1MB font payload (`tailwindcss.com` ships exactly this) | Delayed first paint of text | Subset to latin, preload only the two faces above the fold |

Raise these while designing, not after the build misses its budget, and record the substitution in the page spec so the build agent is not silently overriding a design decision.

---

## What the tool cannot tell you

Say so plainly in the research notes rather than implying full coverage:

- **Whether it is good.** It measures, it does not judge.
- **Anything authored in JavaScript.** Styles set by GSAP, Framer Motion or inline JS never appear in the CSS pass. A site with a rich feel and an empty motion block is animating in JS, and that itself is the finding.
- **Why they chose it.** Intent is inferred, never measured.
- **What it feels like at 60fps under a thumb.** Headless Chrome is not a phone. Scroll the real thing on a real device before promising the same feel.
