# Failure Modes

Every entry here was hit and diagnosed on a real build. Each one looks like a broken design and is not, which is what makes them expensive: the reflex is to redraw the section, and redrawing never fixes any of them.

Read this **before** debugging a layout.

---

## 1. `space_between` reports the wrong `x`, and cascades false "clipped"

**The single biggest source of wasted time on this canvas.**

A `fit_content` child inside a frame with `justifyContent: "space_between"` gets `ctx.bounds.x` reporting its **trailing** edge rather than its leading edge. `x + width` then overflows the parent, so `ctx.problems` marks it `fully clipped`, and every descendant inherits the flag.

Measured, in a 900px frame with 24px padding, one text on the left and a two-item group on the right:

| Reading | `RightGroup` x | width | flag |
|---|---|---|---|
| Browser, from an HTML export (ground truth) | **774** | 102 | — |
| Pencil `ctx.bounds`, parent `space_between` | **876** | 103 | `fully clipped` |
| Pencil `ctx.bounds`, parent `start` | 113 | 103 | ok |
| Pencil `ctx.bounds`, parent `end` | 773 | 103 | ok |
| Pencil `ctx.bounds`, parent `center` | 431 | 103 | ok |

876 is 900 − 24: the right padding edge. The design was correct in every case.

**Only `space_between` is affected.** `start`, `end` and `center` all report correctly.

**What to do.** Nothing, if the arithmetic works out. Confirm with an HTML export if you are unsure. If you want clean readings while building, replace `space_between` with a `fill_container` spacer child, which also gives you control over where the gap actually falls:

```js
row = Insert(page, {type:"frame", name:"NavRow", width:"fill_container",
                    alignItems:"center", gap:40})
Insert(row, {type:"ref", ref:logoId, name:"Logo"})
Insert(row, {type:"frame", name:"NavLinks", width:"fill_container",
             justifyContent:"center", gap:36, alignItems:"center"})
Insert(row, {type:"frame", name:"NavActions", gap:24, alignItems:"center"})
```

**Corollary: `ctx.problems` is a question, not a finding.** Read the bounds and do the arithmetic yourself.

---

## 2. A blank or ghosted screenshot

Three causes, none of them a broken design. Check in this order.

### 2a. The node has no `fill`, so it renders on white

`TakeScreenshot` on a subtree renders it on a transparent ground, which comes out white. A section whose background is inherited from the page rather than set on the section itself photographs as **white text on white**, and reads as "the heading is missing".

This happened to a section header whose `SectionTitle` existed with the right content, right bounds and `fill: "$ink-void"` — and was invisible in every screenshot.

**Fix:** give each section its own `fill` rather than relying on the page ground. Good practice anyway: it makes the section self-contained for the code handoff.

### 2b. The node is far from the user's viewport

The canvas rasteriser only renders the region near where the user is actually looking. A screen two screens to the right returns **blank, ghosted, or rendered-but-truncated**, and this affects `Export` to PNG and PDF as well.

Symptoms: a whole page exports as solid black; a page renders faintly, as if behind a white veil; a page renders correctly for the first N sections and then stops mid-document.

**Fix:** `Export([id], "html-tailwind", "out.html")` and open that in a browser. It is computed from the document rather than the rasteriser, so it is complete and correct regardless of where the viewport is. It is also how you get ground-truth geometry.

**Do not** conclude from a blank screenshot that the design is broken. Read the bounds first.

### 2c. Generated artwork has not landed yet

`Generate` with `"ai"` or `"svg"` returns immediately and finishes later. Screenshots taken in the meantime show an empty frame. That is expected, and re-generating is the wrong reaction. See §6.

---

## 3. HTML export does not carry generated images

`Generate` writes AI and SVG artwork to local files beside the `.pen` (`images/generated-*.png`) and references them by relative path. PNG and PDF exports include them. **`html-tailwind` and `html-css` exports do not copy them.**

So a page can be correct on the canvas and have empty image frames in the exported HTML. That is an export limitation, not a design defect, and it is worth saying out loud in a handoff rather than letting someone conclude the images are missing.

Stock images are unaffected: they are remote URLs and survive the export.

---

## 4. Circular sizing collapses to zero

A `fit_content` parent whose children are all `fill_container` has nothing to measure. The parent sizes to the children, the children size to the parent, and both collapse.

The engine warns:

> Collapsed size: node 'X' uses 'fit_content' sizing on the vertical axis while a child uses 'fill_container'.

**Fix:** give the parent a real size on that axis, or stop one child from filling.

This bites most often on **equal-height rows**, where it looks like a design problem and is not.

---

## 5. Equal-height cards need an explicit height

A row of pricing tiers or feature cards whose bottoms should align: `alignItems: "stretch"` does not exist here, so `fit_content` cards end up at their natural heights and the CTAs sit at different vertical positions. It reads as sloppy.

**Fix:** measure the tallest, then set that height on every card in the row, and give the card's flexible middle section `height: "fill_container"` so the button is pushed to the bottom.

```js
// 1. build them, then read what the tallest actually needs
for (const id of tierIds) Get(id, (n,c) => c.depth===0 && Print(n.name, Math.round(c.bounds.height)))
// 2. set the max on all of them, and let the feature list absorb the slack
for (const id of tierIds)     Update(id,        {height: 540})
for (const id of featureLists) Update(id,       {height: "fill_container"})
```

Do this **after** the content is final. Re-check when copy changes: a longer feature line silently overflows a fixed height.

---

## 6. `Generate` is asynchronous, and polling it wrong is expensive

`"ai"` and `"svg"` return nothing and land after the `execute` call has returned. `"stock"` is the exception and applies its fill during the call.

- **Poll with a cheap read.** `Print(Get(id,{depth:0}).fill)` — an image fill appears as `{type:"image", url:"images/generated-….png"}`. For SVG, `placeholder` stays `true` until the drawing finishes.
- **Never poll with a screenshot.** They are expensive and they do not tell you more.
- **Fire the whole batch, then go build something else.** SVG generation can take minutes. Re-check after finishing another section.
- **Regenerate only when the placeholder flag has cleared and the frame is still empty.** That is the one case where the generation genuinely failed.

---

## 7. Text with no `fill` is invisible

Text nodes have no fill by default. A heading with perfect bounds and content, and no `fill`, renders as nothing. Emoji need it too.

Easy to miss because the node is present in every `Get` and looks completely correct.

---

## 8. Copies get new ids, so `Update` by the original id fails

`Copy` returns a new id and every descendant is renumbered. Addressing the original descendant ids afterwards throws.

**Fix:** customise inside the `Copy` call itself, with the `descendants` map:

```js
v2 = Copy(screenId, document, {name:"Home V2", x:1640, y:0,
  descendants: { [titleId]: {content:"Trained, not styled"},
                 [heroId]:  {fill:"$chalk"} }})
```

The same map works on `ref` instances, where the ids **do** stay stable, because an instance points at the component's own descendants.

---

## 9. An absolutely positioned overlay occludes real content

Overlap is one of the cheapest ways to create depth, and an absolutely positioned card hanging off a panel's corner looks great right up to the moment it covers a row of text.

This is not a tooling bug, it is the thing screenshots exist to catch. It was caught on a real build only by reading the rendered section at full size: an activity-log card was sitting on top of the third row of a queue.

**Fix:** if the overlay has to stay, reserve space for it (extra padding on the panel) or move it to the panel's outer edge. If it does not, make it a real column. Depth from overlap is worth having; depth that hides content is not.

---

## 10. `Get` on the whole document is not available, deliberately

There is no visitor-less full read, because it would serialise the entire document into context. Use a visitor and `Print` one compact row per node:

```js
Get(n => n.reusable && Print(n.id, n.name))
Get(screenId, (n,c) => Print(" ".repeat(c.depth), n.name, Math.round(c.bounds.width)))
```

Storing large `Get` results in globals between calls is also a waste; keep ids and small values only.
