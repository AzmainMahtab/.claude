# Reading a Reference Website

When a user says "make it like <site>", they are pointing at an effect, not asking for a copy. The job is to find the decisions producing that effect, and to keep the ones that fit this project.

Never skim a screenshot and imitate. That reproduces the surface — the colours and the round corners — and misses the structure, which is where the quality actually lives.

---

## The pass

### 1. Fetch it

```
WebFetch(url, "Describe the page structure in order: every section, its purpose,
its heading text, and the ratio of image to text. Note the navigation items, the
primary call to action, and the footer structure.")
```

This gives content architecture — section order, hierarchy, how much they say and where. Often the most transferable thing on the page and the part imitators miss entirely.

### 2. Look at it

The `pencil` MCP `browser` tool opens the live site in the app and can import its design onto the canvas. This is the fastest way to read real spacing, real type sizes and real colour values instead of estimating from a screenshot. Use it when the reference matters enough to measure.

Otherwise, request a screenshot from the user, or reason from the fetched HTML/CSS.

### 3. Extract, decision by decision

Work down this list. For each, write what the reference does and whether it transfers.

**Structure**
- Section order and how many sections before the first call to action
- Where the eye lands first, and what puts it there
- Where the grid is broken, and how often
- Image-to-text ratio, and whether images are contained or full-bleed

**Type**
- How many families; where display is used against text
- The size jump between hero and section heading — the drama of the scale
- Tracking on large text; line height on body
- Measure: how wide the body paragraphs actually run

**Colour**
- How many colours actually ship, versus how many are in the palette
- Where the accent appears, and how rarely
- Whether backgrounds change between sections, and how many tones

**Space**
- Section padding relative to the type size
- Gutters at desktop, and whether the container is generous or tight
- Whether the density is even, or varies deliberately between sections

**Detail**
- Radius policy; border weight; shadow presence
- Button shape and size
- Hover and focus treatments
- Icon style and weight

**Motion**
- What moves, when, and how far
- Whether entrances are staggered
- Whether it scroll-jacks (do not copy it if so)

### 4. Record it

In `DESIGN-GUIDELINES.md`, as specific decisions with reasons:
| Reference | Decision taken | Why it fits here |
|---|---|---|
| `studio-x.com` | Section headings sit in a left column at 1/3 width with content in the right 2/3 — never centred | Gives long service descriptions a readable measure and creates a strong left edge down the page |
| `atelier-y.fr` | Only two surface tones, alternating, with no cards at all | The client's photography is the product; boxes compete with it |
| `venue-z.co` | Display face at 5rem against 1rem body — a 5× jump | Establishes hierarchy without needing colour or weight, which suits a restrained palette |

Anything that cannot be written as a decision with a reason was a vibe, and vibes do not survive to implementation.

---

## Synthesis, not selection

Three references blended with judgement is a design. One reference recoloured is a copy — legally risky, creatively empty, and immediately obvious to the client who named the reference.

Practical version: take **structure** from one, **type behaviour** from another, **colour and detail** from the brand itself. Then check the result against the brief from Step 0 of the skill. If the emotional register the user asked for is not what these decisions produce, the references were wrong for this project — say so and propose different ones rather than delivering a mismatch.

---

## When the reference conflicts with the score targets

Reference sites are frequently slow, and a client admiring one is admiring how it looks, not how it loads. Common conflicts and the substitution:

| Reference does | Cost | Substitute |
|---|---|---|
| Full-screen autoplay video hero | LCP, TBT, bandwidth | Poster image that swaps in video on interaction, or a subtle image treatment |
| Scroll-triggered entrance animation on everything | CLS, TBT, delayed LCP | Motion on interaction only; hero paints immediately |
| Custom cursor, WebGL background | TBT, accessibility | Drop it, or gate behind `prefers-reduced-motion` and pointer:fine |
| Six web font weights | Multiple render-blocking requests | One variable font per family |
| Embedded interactive map | 300–600ms of third-party main-thread time | Static map image that loads the embed on click |

Raise these while designing, not after the build misses 100. Note the substitution in the page spec so the Astro agent is not silently overriding a design decision.
