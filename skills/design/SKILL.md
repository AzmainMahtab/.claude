---
name: design
description: Use when creating or revising any visual design — a page, a screen flow, a landing page, a full site design system, or a redesign — including work in Pencil (.pen) files. Covers reference research, the token system, the mandatory DESIGN-GUIDELINES.md and per-page design .md, the component inventory that makes a design buildable, and the responsive specification at 390/768/1440.
---

# Design Skill

Use this for any design work: a new page, a new system, a revision, or a redesign from reference sites.

The premise: **a design is a system plus a specification, and the canvas is only where it is drawn.** A beautiful screen nobody can rebuild consistently is a liability. So every design here produces two written artefacts alongside the canvas, and neither is optional.

Three companion references live next to this file:

- `references/design-system.md` — the `DESIGN-GUIDELINES.md` template in full: token naming, the type scale maths, the spacing rhythm, and how to measure the contrast table.
- `references/research-protocol.md` — how to read a reference website and extract decisions rather than vibes.
- `references/page-spec-template.md` — the per-page `.md` template, including the Component Inventory table.

Canvas mechanics (the `.pen` schema, `execute`, components, layout) come from the `pencil` MCP tools — call `get_app_state` and `get_guidelines` for those. This skill is about what to draw and why, not how to drive the editor.

---

## Step 0 — Establish the brief before drawing anything

Answer these in the response. If an answer is genuinely unavailable and would change the design, ask; otherwise state your assumption and proceed.

1. **Who is this for, and what do they do next?** Every page has one primary action. Name it. A page with three equal calls to action has none.
2. **What is the emotional register?** Restrained and editorial? Warm and human? Technical and dense? This decides the type, the space, and the palette before any of them are chosen.
3. **What must be on the page?** The content inventory — real sections, real copy lengths. Designing around lorem ipsum produces layouts that break the day real copy arrives.
4. **What is the reference set?** URLs the user admires, or an existing brand to extend. See Step 1.
5. **Is there an existing system?** If `DESIGN-GUIDELINES.md` exists for this project, you are extending it, not starting over. Read it first and stay inside it.

---

## Step 1 — Research the references properly

When the user names reference sites, do not glance and imitate. Fetch each one and extract specific, transferable decisions. Full method: `references/research-protocol.md`.

Tools, in order of preference:

- `WebFetch` on the URL — structure, copy hierarchy, section order, the words they use.
- The `pencil` MCP `browser` tool — opens the live site in the app and can import its design onto the canvas, which is by far the fastest way to read real spacing and colour.
- `WebSearch` for the studio's other work when you want the pattern behind one site rather than the one site.

For each reference, record in the design doc:

| Reference | What was taken | Why it fits |
|---|---|---|
| `studio-x.com` | The full-bleed hero image with the headline offset to the lower-left third | Puts the venue photography first, which is this client's actual asset |

"Inspired by" is not a record. Name the decision, or leave it out. And take structure, type behaviour and rhythm — never a layout wholesale. Three references blended with judgement is a design; one reference recoloured is a copy.

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

Durations (150–250ms for UI, up to 400ms for larger transitions), easing (`ease-out` for entrances, `ease-in-out` for state changes), and what moves. Everything honours `prefers-reduced-motion`.

No scroll-jacking. No entrance animation on the hero headline or hero image — it delays the largest paint and is measurable in the performance score.

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
6. **Interaction notes** — what is interactive, and the non-JS fallback. The Astro side prefers CSS-only and real routes over islands; a design that assumes a client-side filter should say whether real category URLs would serve as well.
7. **SEO intent** — title, meta description, the one `h1`, and the heading outline.

---

## Anti-slop rules

The default AI design is recognisable and it is not what we ship. Specifically:

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
- [ ] Reference research is recorded as specific decisions with reasons.
- [ ] Anti-slop pass: no unjustified cards, no repeated identical grids, no centred-everything, one accent.
