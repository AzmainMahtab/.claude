---
name: design
description: Use when creating or revising any visual design — a page, a screen flow, a landing page, a full site design system, or a redesign — including work in Pencil (.pen) files. Covers reference research, the token system, the mandatory DESIGN-GUIDELINES.md and per-page design .md, the component inventory that makes a design buildable, and the responsive specification at 390/768/1440.
---

# Design Skill

Use this for any design work: a new page, a new system, a revision, or a redesign from reference sites.

The premise: **a design is a system plus a specification, and the canvas is only where it is drawn.** A beautiful screen nobody can rebuild consistently is a liability. So every design here produces two written artefacts alongside the canvas, and neither is optional.

Five companion references live next to this file:

- `references/award-bar.md` — what separates award-level work from competent work: the one-sentence test, the six axes, rhythm, the peak, and the full anti-slop list. **Read this first on any project that is meant to be exceptional rather than correct.**
- `references/research-protocol.md` — how to read a reference website with measurements instead of impressions, using `scripts/teardown.mjs`.
- `references/design-system.md` — the `DESIGN-GUIDELINES.md` template in full: token naming, the type scale maths, the spacing rhythm, and how to measure the contrast table.
- `references/motion.md` — the motion spec: the four jobs, the curve vocabulary, the duration ladder, stagger, scroll-linked rules, and the motion table every page spec carries.
- `references/page-spec-template.md` — the per-page `.md` template, including the Component Inventory table.

One script, `scripts/teardown.mjs`, does the forensic read of a live site. It needs `npm i playwright-core` once and a Chrome on the machine.

Canvas mechanics are the **`pencil` skill**: the build order (tokens, then components, then screens), the verification snippets that audit a design on the canvas before any code exists, and the tested failure modes the MCP's own guidelines do not cover. Load it before touching a `.pen` file. The raw `.pen` schema and the `execute` API come from the `pencil` MCP tools themselves via `get_app_state` and `read_skill`.

This skill is about what to draw and why, not how to drive the editor.

---

## Step 0 — Establish the brief before drawing anything

Answer these in the response. If an answer is genuinely unavailable and would change the design, ask; otherwise state your assumption and proceed.

1. **Who is this for, and what do they do next?** Every page has one primary action. Name it. A page with three equal calls to action has none.
2. **What is the emotional register?** Restrained and editorial? Warm and human? Technical and dense? This decides the type, the space, and the palette before any of them are chosen.
3. **What must be on the page?** The content inventory — real sections, real copy lengths. Designing around lorem ipsum produces layouts that break the day real copy arrives.
4. **What is the reference set?** URLs the user admires, or an existing brand to extend. See Step 1.
5. **Is there an existing system?** If `DESIGN-GUIDELINES.md` exists for this project, you are extending it, not starting over. Read it first and stay inside it.
6. **What is the one sentence?** Complete: "It's the site where ___", with an experience rather than a feature. If the only available answer is "it's clean and it works", there is no idea yet and drawing will not produce one. Full method in `award-bar.md` §1. Everything on the page either serves that sentence or gets cut.

---

## Step 1 — Research the references properly

When the user names reference sites, do not glance and imitate, and do not guess at the mechanics. **Measure first, judge second.** Full method: `references/research-protocol.md`.

**Measure it.** One command per reference:

```bash
npm i playwright-core                                   # once
node <skill>/scripts/teardown.mjs https://ref.com --out research/
node <skill>/scripts/teardown.mjs https://ref.com --mobile
```

It reports what the site is actually built with, not what it looks like it is built with: framework and animation libraries, the fonts as rendered with their weights and tracking, the type ladder and its median ratio, the palette weighted by painted area with every ink/ground pair measured for contrast, the spacing base unit, container widths, the duration and easing histograms including raw `cubic-bezier` values, and the byte weight by resource type.

It warns loudly when it has captured a bot wall or an unhydrated shell instead of the page. **Heed that warning** — a confident teardown of a Cloudflare interstitial looks exactly like evidence.

**Then judge it by eye**, because the tool cannot: what the one idea is, where the eye lands first, the rhythm of the bands, what they deliberately did not do. `WebFetch` is still the fastest read of content architecture; the `pencil` `browser` tool imports a section onto the canvas when a composition is worth studying closely.

**Then record decisions with their measurement:**

| Reference | Measured | Decision taken | Why it fits here |
|---|---|---|---|
| `studio-x.com` | Display 96px against 17px body, 5.6×; one family, two weights | Hierarchy from scale alone, not colour or weight | The client's palette is two neutrals; scale is the only lever with that range |

"Inspired by" is not a record. Name the decision, or leave it out. Take structure from one reference, type behaviour from another, colour and detail from the brand. Three references blended with judgement is a design; one reference recoloured is a copy.

---

## Step 2 — Build the system before the first screen

Write `<project>/.claude-project/design/DESIGN-GUIDELINES.md` **first**. Template and full detail in `references/design-system.md`. It contains:

### Colour

A role-named palette, not a swatch dump. `surface`, `surface-raised`, `ink`, `ink-muted`, `accent`, `accent-ink`, `border`, plus semantic states if the site needs them. One accent. If a second is genuinely required, it is a tint of the first.

Roughly 60% dominant surface, 30% secondary, 10% accent. Accent used sparingly is what makes it read as accent; used everywhere it reads as noise.

**The contrast table is part of this section and is mandatory.** Every foreground/background pair that will ship, with its measured ratio:

| Foreground | Background | Ratio | Use | Pass |
|---|---|---|---|---|
| `--color-ink` #F4F6FB | `--color-surface` #0B1733 | 15.8:1 | Body, headings | AAA |
| `--color-ink-muted` #A8B4D0 | `--color-surface` #0B1733 | 7.9:1 | Secondary text | AAA |
| `--color-accent-ink` #0B1733 | `--color-accent` #C9A227 | 8.4:1 | Primary button | AAA |

Body ≥ 4.5:1. Large text and UI boundaries ≥ 3:1. Measure the actual pair — do not estimate from the hex. A pair that fails does not enter the palette. **This table is why the built site scores 100 on accessibility without a rework pass**, and it costs ten minutes now against a day later.

### Type

Two families maximum — one display, one text. A modular scale (1.2 for dense, 1.25 for balanced, 1.333 for dramatic), expressed as fluid `clamp()` values so there is no jump at a breakpoint.

Also specify, because these are what separate typeset from typed:
- Tracking tightens as size grows — roughly `-0.02em` at display, `0` at body.
- Line height loosens as size shrinks — `0.95` at display, `1.6–1.7` at body.
- Measure of 60–75 characters for body copy. Not "max-w-full".
- One weight pairing that carries the whole site. Three weights is a system; six is indecision.

### Space

An 8pt base. Section padding and page gutters are fluid `clamp()` values, so mobile breathes proportionally instead of getting desktop's padding divided by two.

State the rhythm explicitly: space between a heading and its body, between body and the next heading, between items in a grid, between sections. Consistent rhythm is most of what reads as "polished".

### Grid and breakpoints

- Container max width, gutters at each breakpoint, column count.
- Breakpoints: **390 / 768 / 1440** minimum. Add more only where the design actually needs one.
- Name where the grid is deliberately broken — a full-bleed image, an overlapping card, an asymmetric split. One or two per page. This is what stops a site looking like a template.

### Motion

Full spec: `references/motion.md` for **what** the motion is and why. The **`motion` skill** carries the implementation: a tested zero-JS runtime, copy-paste recipes and an audit script. Design it here rather than leaving it to the build.

The guidelines file names: the **curve vocabulary** (two or three curves for the whole site, with values, not adjectives), the **duration ladder** by move size, the stagger interval, what the reduced-motion state is, and the one signature moment.

Non-negotiable regardless of taste: nothing animates the hero; no scroll-jacking; `transform` and `opacity` only for anything continuous; never `ease-in` on an entrance; reduced motion means fewer and gentler, not zero.

### Component rules

Radius scale, border weights, shadow policy, icon set and stroke weight, image treatment and aspect ratios, focus ring. Pick a policy and hold it: hairline rules **or** cards, not both; 2px radius **or** fully rounded, not 12px on everything.

---

## Step 3 — Name the components before drawing them

List the components the page needs before opening the canvas. Every element that ships belongs to a named component. If it cannot be named, it should not be drawn.

Build them in the `.pen` file as actual reusable components (`reusable: true`) and instance them with `ref` — so a change to the navbar changes all seven pages, exactly as it will in code. A design where the footer is copy-pasted seven times will drift, and the drift becomes seven slightly different footers in the codebase.

Name components for what they **are**, not what they look like: `CtaBanner`, not `GoldStripe`. The gold changes; the role does not. The name in the design is the filename in code — that is the whole point of the Component Inventory.

---

## Step 4 — Draw it, mobile-considered

Design at 1440 if that is the natural working width, but decide the 390 behaviour for each section **as you draw it**, not afterwards. Retrofitted responsive design is where designs get compromised.

For each section, know the answer to: what stacks, what reflows, what shrinks, what is dropped, and what the type scale does. Record it in the page spec as you go — that is Step 5 and it is not a separate pass.

Canvas discipline (the `pencil` guidelines cover the rest):
- Use flex layout with `fill_container` / `fit_content`. Hardcoded pixel widths on children are how a design becomes un-rebuildable.
- Real copy, real lengths. The longest plausible service name, not "Service One".
- Verify each section as you finish it: no clipping, no collapsed frames, alignment holds.

---

## Step 5 — Write the page spec

`<project>/.claude-project/design/pages/<page>.md`. Template: `references/page-spec-template.md`. It carries:

1. **Purpose and primary action** — one sentence each.
2. **Section list in order** — with the canvas node id for each, so the drawing and the doc stay findable from one another.
3. **The Component Inventory table** — the handoff contract:

   | Component | Canvas node | Code path | Props | Used on |
   |---|---|---|---|---|
   | `Hero` | `Hero V3` | `src/components/sections/Hero.astro` | `title`, `subtitle`, `cta`, `image` | Home |
   | `CtaBanner` | `CTA Banner V3` | `src/components/sections/CtaBanner.astro` | `title`, `body`, `cta` | All 7 pages |

4. **Responsive behaviour per section at 390 / 768 / 1440** — stated, not implied.
5. **Content requirements** — character limits for headlines and body, image aspect ratios and subjects, alt text intent.
6. **The motion table** — one row per move: element, trigger, what moves, duration, curve, reduced-motion state. Template in `references/motion.md` §9. If every row is identical you have applied a plugin, not choreographed a page.
7. **Interaction notes** — what is interactive, and the non-JS fallback. The Astro side prefers CSS-only and real routes over islands; a design that assumes a client-side filter should say whether real category URLs would serve as well.
8. **SEO intent** — title, meta description, the one `h1`, and the heading outline.

---

## Anti-slop rules

The default AI design is recognisable and it is not what we ship. The full list, by category, is in `award-bar.md` §6. The ones that matter most:

- **Not everything is a card.** A container needs a structural or functional reason. A list of three things is a list; giving each a bordered, shadowed, rounded box is a reflex, not a decision.
- **Not four identical 3-column icon grids** stacked down the page. Vary the rhythm: a wide editorial split, then a full-bleed image, then a tight grid, then a quiet band of text.
- **No purple-to-blue gradient.** No gradient at all unless the brand has one.
- **Not everything centred.** Centred hero, centred section headers, centred cards, centred footer — it flattens hierarchy and reads as a template. Left-align body copy; centre only what earns it.
- **Restraint with effects.** Shadows, gradients and 12px radii everywhere are decoration standing in for hierarchy. Get the hierarchy from type scale, weight, space and one accent instead.
- **Real imagery, art-directed.** One consistent grade. Not a collage of unrelated stock.
- **Real copy.** Write the actual headline. "Empower your workflow" is a placeholder wearing a suit, and the layout it produces will not survive real content.
- **Whitespace is the luxury signal.** When something feels cheap, the answer is usually more space, not more elements.

---

## Review checklist

Before handing a design to code:

- [ ] `DESIGN-GUIDELINES.md` exists, and every colour, size and family used on the canvas is a named token in it.
- [ ] The contrast table covers every shipping pair, measured, all passing.
- [ ] `pages/<page>.md` exists with a complete Component Inventory — every canvas element traces to a named component and an intended code path.
- [ ] Responsive behaviour is stated for every section at 390, 768 and 1440.
- [ ] Repeated elements are real `.pen` components with instances, not copies.
- [ ] Exactly one `h1`-level headline; the heading outline descends without gaps.
- [ ] Interactive elements have a stated non-JS fallback.
- [ ] Reference research is recorded as specific decisions **with the measurement next to each one**.
- [ ] The motion table is filled in, with real curve values and a reduced-motion column.
- [ ] Anti-slop pass: no unjustified cards, no repeated identical grids, no centred-everything, one accent.

And, for anything meant to be better than correct (`award-bar.md` §8):

- [ ] The one-sentence test has an answer, and it is about an experience.
- [ ] Six axes scored, nothing below 2.
- [ ] No two adjacent bands behave the same way.
- [ ] Exactly one peak, with the most room and a quieter band before it. The close resolves and holds.
- [ ] **Teardown run against your own build.** The type ladder, spacing base and contrast pairs it reports should match `DESIGN-GUIDELINES.md`. If your own numbers surprise you, the system drifted during the build.
