# Component Patterns

How to build a `.pen` component library that survives being instanced across seven screens, and that maps one-to-one onto the code the build agent will write.

The test for every pattern here: **changing the component changes every screen.** If a change requires visiting each page, it was not a component.

---

## 1. Build it, capture the ids, then instance it

The descendant ids are how you override an instance. Capture them when you create the component, because digging them back out later is tedious.

```js
btnId = Insert(document, {type:"frame", name:"ButtonPrimary", reusable:true,
  x:0, y:0, fill:"$accent", height:48, padding:[0,28],
  alignItems:"center", justifyContent:"center", placeholder:true})
btnLabelId = Insert(btnId, {type:"text", name:"Label",
  fontFamily:"$font-text", fontSize:"$text-eyebrow", fontWeight:"600",
  letterSpacing:2.16, fill:"$accent-ink", content:"SHOP THE DROP"})
Update(btnId, {placeholder:false})
```

Instance with `type:"ref"` and override inline:

```js
Insert(hero, {type:"ref", ref:btnId, name:"Hero CTA",
  descendants:{ [btnLabelId]: {content:"BOOK A DEMO"} }})
```

**Instance descendant ids are stable**, unlike copies. `Copy` renumbers everything (`failure-modes.md` §8); `ref` points at the component's own children, so `[btnLabelId]` keeps working on every instance forever.

You can also address them by path in later calls: `Update(instanceId + "/" + btnLabelId, {...})`, `Replace("inst/child", {...})`.

---

## 2. Naming is the handoff contract

Name components for what they **are**, not what they look like. `CtaBanner`, not `GoldStripe`. The gold changes; the role does not.

The name in the canvas becomes the filename in code, and that correspondence is the whole point of the page spec's Component Inventory:

| Canvas node | Code path |
|---|---|
| `SiteHeader` | `src/components/sections/SiteHeader.astro` |
| `ProductCard` | `src/components/sections/ProductCard.astro` |
| `Button` | `src/components/primitives/Button.astro` |

Name instances for their content, not their component: `Card — Velocity Training Vest`, not `ProductCard 3`. It makes the layer list readable and it makes a `Get` visitor's output legible.

---

## 3. The two-tone problem

A component that appears on both a light and a dark ground is the most common reason people give up and copy-paste.

**Three options, in order of preference.**

### a. Make the chrome one-tone by decision

The cheapest fix is a design decision rather than a technical one: decide the header and footer are *always* the dark world, whatever the page ground. One component, no overrides, and it anchors the brand across a light commerce page and a dark editorial one.

Take this option whenever the brief allows it.

### b. A `tone` override map, applied at instance time

When the component genuinely has to invert, define the swap once as a constant and spread it into every light instance:

```js
LIGHT = { [plateId]: {fill:"$chalk-raised"},
          [titleId]: {fill:"$ink-chalk"},
          [metaId]:  {fill:"$ink-chalk-muted"},
          [priceId]: {fill:"$ink-chalk"} }

Insert(row, {type:"ref", ref:cardId, name:"Card — "+title, width:"fill_container",
  descendants: Object.assign({}, LIGHT, {
    [titleId]: {content:title, fill:"$ink-chalk"},
    [priceId]: {content:price, fill:"$ink-chalk"} })})
```

**Order matters.** `Object.assign` means a later key wins, so a per-instance override that sets only `content` will *drop* the tone's `fill` for that node. Merge the two explicitly, as above, rather than hoping.

This maps cleanly onto a `tone="light"` prop in code, which is what the page spec should say.

### c. Two components

Only when the two versions differ structurally, not just in colour. Two components that differ by four fills is a maintenance trap; two that differ in layout are two components.

---

## 4. Equal-height rows

`alignItems: "stretch"` does not exist. A row of pricing tiers left as `fit_content` ends up ragged, with the CTAs at different heights, and it reads as sloppy.

```js
// 1. build them with real content first
// 2. measure
for (const id of tierIds) Get(id,(n,c)=>c.depth===0&&Print(n.name,Math.round(c.bounds.height)))
// 3. set the max on all of them, and let the flexible middle absorb the slack
for (const id of tierIds)      Update(id,  {height: 540})
for (const id of featureListIds) Update(id, {height: "fill_container"})
```

The component itself needs the fixed height too, or it collapses: a `fit_content` parent whose child is `fill_container` is circular (`failure-modes.md` §4).

**Re-measure when the copy changes.** A fixed height silently clips a longer feature line.

---

## 5. Optional parts

There is no way to delete a descendant of an instance. Override `enabled: false`:

```js
d = { [titleId]: {content:title} }
d[badgeId] = badge ? {} : {enabled:false}
if (badge) d[badgeLabelId] = {content:badge}
Insert(row, {type:"ref", ref:cardId, descendants:d})
```

Two consequences worth knowing:

- A disabled descendant still exists in the tree, still carries the component's default content, and **still shows up in a resolved `Get`**. Every audit snippet has to skip it, or it reports contrast failures on text nobody can see (`verify-snippets.md` §3).
- In code this is a conditional render (`{badge && <Badge/>}`), so say so in the page spec's props column.

---

## 6. Sizing children, not repeating the parent

Never hardcode the parent's width on several children. It looks fine and it breaks the first time the container changes.

```js
// wrong: three places to update
Insert(row,{type:"frame",width:312}); Insert(row,{type:"frame",width:312}) …

// right: the row distributes, the gap spaces
row = Insert(section,{type:"frame",name:"Rail",width:"fill_container",gap:"$space-item"})
for (const p of products) Insert(row,{type:"ref",ref:cardId,width:"fill_container", …})
```

Text follows the same rule with one extra step: **`fill_container` on a text node needs `textGrowth:"fixed-width"`**, or the width is ignored and the text never wraps.

```js
Insert(card,{type:"text",name:"Title",textGrowth:"fixed-width",width:"fill_container",
             content:title, fontSize:"$text-body", fill:"$ink"})
```

---

## 7. Build the library in one pass, with a loop

Repeated structure is generated, not hand-written. It is shorter, it cannot drift, and the ids come back in one response.

```js
const COLS = [["SHOP",["Men","Women","Footwear","Sale"]],
              ["TRAIN",["Programs","Coaches","Membership"]],
              ["SUPPORT",["Shipping","Returns","Contact"]]]
for (const [head, items] of COLS) {
  const col = Insert(footerCols,{type:"frame",name:"Col "+head,layout:"vertical",gap:16,width:150})
  Insert(col,{...EYEBROW, name:"Heading", content:head})
  for (const i of items) Insert(col,{...LINK, name:i, content:i})
}
```

Define shared style objects once and spread them, and **include `type` in the style object** so the spread is complete:

```js
LINK = {type:"text", fontFamily:"$font-text", fontSize:"$text-small", fill:"$ink-muted"}
```

---

## 8. Screens are instances plus content

A finished screen should be mostly `ref` nodes. When you find yourself building the same structure twice inside one document, stop and extract it — the second occurrence is the cheapest moment to do it, and every occurrence after that is more expensive.

Run `verify-snippets.md` §4 before handoff. A screen with almost no `ref` nodes was built by copy-paste, and it will be rebuilt by copy-paste.
