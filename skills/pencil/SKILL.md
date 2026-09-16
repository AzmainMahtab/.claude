---
name: pencil
description: Use when designing on the Pencil canvas (.pen files) through the pencil MCP tools — building a design system as document variables, composing screens from reusable components, verifying a layout, or debugging why a frame looks wrong. Carries the build order, the verification loop that actually works, and the tested failure modes the MCP's own guidelines do not cover.
---

# Pencil

The `pencil` MCP tools are the mechanism: `get_app_state` and `read_skill` carry the `.pen` schema and the `execute` API, and you should read them. **This skill is the part that is not in those docs**: the order to build in, how to verify a layout when the built-in verification lies to you, and the failure modes that each cost a round of rework.

Three companion references:

- `references/failure-modes.md` — the tested list. Read it before debugging anything, because most "the layout is broken" reports on this canvas are one of these instead.
- `references/verify-snippets.md` — copy-paste `execute` snippets that audit a design: token compliance, contrast, component reuse, layout, orphan nodes.
- `references/component-patterns.md` — how to build a component library that survives being instanced across seven screens.

**What this skill is not.** It does not decide what to draw. That is the `design` skill: the brief, the system, `award-bar.md` for whether the thing is any good, and the two documents every design ships with. Canvas work that is not written down is not finished.

---

## The rule that saves the most time

> **`ctx.problems` is not a layout checker. Treat a "clipped" flag as a question, never as a finding.**

It produces false positives constantly, and the biggest source is documented in `failure-modes.md` §1: any `fit_content` child inside a frame with `justifyContent: "space_between"` gets bounds reporting its **trailing** edge as `x`, which makes `x + width` overflow the parent, which cascades a false `fully clipped` onto it and every descendant.

Measured on this canvas: a group whose true position is `x 774, w 102` inside a 900px frame reports `x 876, w 103, fully clipped`. Switch the parent to `start`, `end` or `center` and the same group reports correctly. Nothing was wrong with the design.

So the verification loop is: **read the numbers, not the flags.** `references/verify-snippets.md` has one that works.

---

## Build order

Inside out. A screen assembled before its components exist becomes seven slightly different footers.

### 1. Tokens first, as document variables

Every colour, size and family in `DESIGN-GUIDELINES.md` becomes a `.pen` variable, so the canvas and the code share one vocabulary and a palette change is one call.

```js
SetVariables({
  "void":        {type:"color",  value:"#0B0B0B"},
  "ink":         {type:"color",  value:"#FFFFFF"},
  "accent":      {type:"color",  value:"#FF4A1C"},
  "font-display":{type:"string", value:"Barlow Condensed"},
  "text-h2":     {type:"number", value:44},
  "gutter":      {type:"number", value:80}
})
```

Then reference them everywhere: `fill: "$void"`, `fontSize: "$text-h2"`, `padding: [0, "$gutter"]`.

`SetVariables` merges by default. Read first with `Print(GetVariables())` so you do not quietly overwrite a live token. Names never start with `$`; the `$` is only for referencing.

**Pencil has no `clamp()`.** Set the 1440 value as the variable and record the fluid clamp in `DESIGN-GUIDELINES.md`. The canvas is the desktop specimen; the doc is the responsive contract.

### 2. Components next, `reusable: true`

Build every repeated element as a real component and instance it with `type: "ref"`. A copy-pasted navbar drifts, and the drift ships as seven navbars in the codebase.

```js
btnId = Insert(document, {type:"frame", name:"ButtonPrimary", reusable:true,
  x:0, y:0, fill:"$accent", height:48, padding:[0,28],
  alignItems:"center", justifyContent:"center", placeholder:true})
btnLabelId = Insert(btnId, {type:"text", name:"Label", content:"SHOP THE DROP",
  fontFamily:"$font-text", fontSize:"$text-eyebrow", fill:"$void"})
Update(btnId, {placeholder:false})
```

**Capture the descendant ids.** They are how you override an instance, and you cannot get them back conveniently later:

```js
Insert(page, {type:"ref", ref:btnId, name:"Hero CTA",
  descendants: {[btnLabelId]: {content:"BOOK A DEMO"}}})
```

Full patterns, including the two-tone problem and equal-height rows, in `references/component-patterns.md`.

### 3. Screens last

One top-level frame per screen, `clip: true`, laid out left to right and down. Components live above the screens.

Keep the document root clean: only screen frames, reusable component frames and major containers. Never a loose text node or rectangle at root.

### 4. Verify each section as you finish it

Not at the end. `references/verify-snippets.md` §1.

---

## Verification that works

Four passes, in this order, because each catches what the one before cannot.

**1. Geometry, by arithmetic.** Read `ctx.bounds` and check the numbers yourself: does a child's `x + width` exceed its parent's inner width, does a row's children sum past the container, is any frame zero-height. Ignore `ctx.problems`.

**2. Token compliance, by scan.** Walk every node and flag any `fill`, `stroke` or `fontSize` that is a literal instead of a `$variable`. This is the single highest-value audit on the canvas: it catches the system decaying while you work, and it takes one snippet. Snippet in §2 of the reference.

**3. Screenshot, once a section is complete.** Never per edit. And read `failure-modes.md` §2 first, because a blank screenshot usually means one of three known things rather than a broken design.

**4. Export to HTML when the screenshot cannot be trusted.** `Export([id], "html-tailwind", "out.html")` computes the layout independently of the canvas rasteriser. Open it in a browser and measure `getBoundingClientRect()`. This is the ground truth that settled the `space_between` bug above, and it is the right move whenever a screenshot and the numbers disagree.

---

## Reading and writing, correctly

- **`Get` arguments are recognised by type**, so unused ones are omitted: `Get(id, {depth:1})`, `Get(id, visit)`, `Get(visit)` all work.
- **Use a visitor to Print one compact row per node.** Dumping JSON of a subtree burns context for no gain.
- **`resolveInstances: true`** expands `ref` nodes so you can read and address their children as `instanceId/childId`.
- **`resolveVariables: true`** gives computed values instead of `$name`, which is what you want when auditing and not what you want when copying nodes.
- **Every `execute` has its own scope.** `const`/`let` do not survive between calls; assign without a keyword (`myId = Insert(...)`) to persist an id.
- **On failure, retry with `edits` and the returned `editId`.** Never resend the whole snippet.
- **Never set `id`.** Pencil assigns them.

---

## Generated artwork

`Generate(nodeId, type, prompt)` is asynchronous for `"ai"` and `"svg"` and lands after the call returns. `"stock"` is the exception and applies during the call.

- **Poll with a cheap read, never a screenshot.** `Print(Get(id,{depth:0}).fill)` tells you whether an image fill arrived; an SVG frame keeps `placeholder: true` until its drawing finishes.
- **Fire a batch, then keep building.** Re-check after finishing another section, not after every call.
- **One style preamble, reused verbatim** in every image prompt. That is what makes six separately generated images look like one shoot.
- **Look at every asset before you rely on it.** Stock queries return a parking lot for "training shoes" often enough that it is worth the read, and rerolling is cheap.
- **Generated images are local files** (`images/generated-*.png`) next to the `.pen`. They render on the canvas and in PNG/PDF exports, but **HTML export does not copy them**, so a section can be correct on the canvas and empty in the exported HTML. That is an export limitation, not a design defect.

---

## Hard rules

| Never | Instead |
|---|---|
| `Read` or `Grep` a `.pen` file | It is encrypted. Only the `pencil` MCP tools can see it |
| Trust `ctx.problems` | Read the bounds and do the arithmetic. `failure-modes.md` §1 |
| Percentage or viewport sizes (`"100%"`, `"50vh"`) | `fill_container`, `fit_content`, or a real pixel number |
| `alignItems: "baseline"` or `"stretch"`, or `margin` | Not supported. Wrap in a frame with padding to offset a child |
| `fit_content` parent whose every child is `fill_container` | Circular. Give the parent a size, or stop one child filling |
| Hardcode the parent's width on several children | `fill_container` on each, `gap` on the parent |
| Set `width`/`height` on text without the matching `textGrowth` | `fit_content` is `auto`; wrapping needs `fixed-width` plus `width` |
| Forget `fill` on a text node | Text has no fill by default and is invisible |
| Copy-paste a repeated element | `reusable: true` once, `type:"ref"` instances after |
| `Update` a copied node's descendants by their original ids | Copies get new ids. Use the `descendants` map inside the `Copy` call |
| Delete a descendant of an instance | Override `enabled: false` on it |
| Leave `placeholder: true` on a finished frame | Clear it the moment the frame is done. It marks work in progress to the user watching the canvas live, and an SVG generation clears it for you when the drawing lands |
| Screenshot after every edit | Once per finished section. They are expensive and they obscure detail on large nodes |
| Redraw a design to fix it | Update the existing nodes. Never delete and rebuild |
