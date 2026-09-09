# Page Spec Template

One per page, at `<project>/.claude-project/design/pages/<page>.md`. This is the file the Astro agent builds from — it is a contract, not a description.

```markdown
# <Project> — <Page> Design Spec

**Canvas:** `<path>.pen`, node `<id>` — "<node name>"
**Guidelines:** `../DESIGN-GUIDELINES.md`
**Status:** <Draft | Ready for build | Built>
**Last updated:** YYYY-MM-DD

## Purpose

One sentence: what this page is for.
**Primary action:** the one thing a visitor should do. Named, singular.
**Secondary action:** at most one.

## Sections, in order

| # | Section | Canvas node | Purpose |
|---|---|---|---|
| 1 | Navbar | `Navbar V3` | Wayfinding + persistent CTA |
| 2 | Hero | `Hero V3` | Establish register; primary action |
| 3 | Stats strip | `Stats Strip V3` | Credibility in one glance |
| 4 | Services | `Services V3` | Scope of work; route to Services |
| … | | | |

## Component inventory

The handoff contract. Every element on the canvas appears here.

| Component | Canvas node | Code path | Props | Used on |
|---|---|---|---|---|
| `Navbar` | `Navbar V3` | `src/components/sections/Navbar.astro` | `active` | All pages |
| `Hero` | `Hero V3` | `src/components/sections/Hero.astro` | `title`, `subtitle`, `cta`, `image`, `imageAlt` | Home |
| `StatsStrip` | `Stats Strip V3` | `src/components/sections/StatsStrip.astro` | `stats: {value, label}[]` | Home, About, Portfolio |
| `Button` | `Nav CTA V3` | `src/components/primitives/Button.astro` | `href`, `variant` | Everywhere |

Rules: reused across pages → `sections/`. No business meaning → `primitives/`. Needs a `client:` directive → `islands/`, and say why here.

## Responsive behaviour

Per section, at all three widths. Stated, not implied.

### Hero
| | 390 | 768 | 1440 |
|---|---|---|---|
| Layout | Image full-bleed behind, copy stacked below | Same, copy overlaid lower-left | Copy in left 6 of 12, image bleeding right |
| Headline | `--text-display` min (40px), 3 lines | 56px, 2 lines | 80px, 2 lines |
| CTAs | Full-width stacked, 12px gap | Inline | Inline |
| Image | 4/3 crop, subject centre | 16/9 | 16/9, subject right of centre |
| Height | Content-driven, min 80dvh | 90dvh | 780px |

### Services
| | 390 | 768 | 1440 |
|---|---|---|---|
| Grid | 1 column | 2 columns | 3 columns |
| Heading block | Above grid, full width | Above grid, 60% width | Left column, grid in right 2/3 |
| Item body | Truncated to 2 lines | Full | Full |

## Content requirements

| Slot | Limit | Notes |
|---|---|---|
| Hero headline | ≤ 48 chars | Must read on 3 lines at 390 without a widow |
| Hero subtitle | ≤ 140 chars | |
| Service title | ≤ 24 chars | Longest real one: "Decoration & Set Design" |
| Service body | 90–120 chars | Sets the card height; do not design around the shortest |

### Imagery
| Slot | Ratio | Subject | Alt intent |
|---|---|---|---|
| Hero | 16/9 desktop, 4/3 mobile | Wide venue shot, warm evening light | What the room is and the scale of the event |
| Portfolio grid | 4/3 | One detail per image, consistent grade | The specific element shown |

## Interaction

| Element | Behaviour | Without JavaScript |
|---|---|---|
| Portfolio filter tabs | Filters the grid in place | All items visible; tabs are links to `/portfolio/<category>/` |
| FAQ accordion | One open at a time | Native `<details>`; all independently openable |
| Mobile nav | Full-screen `<dialog>` | Anchor to a footer nav, or the dialog renders open |

If the design assumes a client-side interaction where real URLs would serve as well, say so — the Astro side prefers routes, and this is where that gets agreed rather than silently overridden.

## SEO intent

- **Title:** `<page title>` — ≤ 60 chars
- **Meta description:** `<description>` — 120–160 chars
- **H1:** the single `h1`, and where it sits
- **Heading outline:** h1 → h2 (Services) → h3 (each service) → h2 (Portfolio) → …
- **Structured data:** `LocalBusiness` site-wide; `FAQPage` on the FAQ section
- **OG image:** 1200×630, `/og/<page>.jpg`

## Open questions

Anything unresolved, with who decides. Empty is a valid answer — an unlisted assumption is not.
```

---

## Why each part is here

- **The component inventory** is what makes a design buildable twice. Without it, the second page reimplements the first page's footer slightly differently, and the divergence is permanent.
- **The three-column responsive table** is what stops responsive being an afterthought. A designer who cannot fill it has not finished designing.
- **Content limits** are what stop the layout breaking on real copy. Design around the longest plausible string, not the demo one.
- **The no-JS column** is what keeps the performance and SEO scores reachable. It is a design decision, so it is made here — not improvised during the build.
