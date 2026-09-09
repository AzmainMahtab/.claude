# `DESIGN-GUIDELINES.md` — Template and Method

One per project, at `<project>/.claude-project/design/DESIGN-GUIDELINES.md`. Written before the first screen, extended as the system grows, never forked.

It has one job: **anyone — a designer, the Astro agent, or a human six months from now — can produce a new page that looks like it belongs, without asking.**

---

## The template

```markdown
# <Project> — Design Guidelines

**Status:** <Draft | FINAL>. Supersedes: <previous version, if any>.
**Design file:** <path to .pen>
**Last updated:** YYYY-MM-DD

## 0. Character

Three or four sentences. What this brand feels like, and what it deliberately is not.
"Restrained, editorial, photography-led. Navy and gold, used sparingly. Generous space.
Not glossy, not corporate, not a template."

Then the reference table — what was taken from where, and why.

## 1. Colour

### Palette
| Token | Value | Role |
|---|---|---|
| `--color-surface` | #0B1733 | Page background |
| `--color-surface-raised` | #132349 | Cards, elevated bands |
| `--color-ink` | #F4F6FB | Primary text |
| `--color-ink-muted` | #A8B4D0 | Secondary text, captions |
| `--color-accent` | #C9A227 | Single accent — CTAs, rules, eyebrows |
| `--color-accent-ink` | #0B1733 | Text on accent |
| `--color-border` | #FFFFFF1F | Hairlines |

### Contrast (mandatory — every shipping pair, measured)
| Foreground | Background | Ratio | Use | Result |
|---|---|---|---|---|
| ink | surface | 15.8:1 | Body, headings | AAA |
| ink-muted | surface | 7.9:1 | Secondary text | AAA |
| ink-muted | surface-raised | 6.1:1 | Card body | AA |
| accent-ink | accent | 8.4:1 | Primary button | AAA |
| accent | surface | 6.4:1 | Eyebrow, links | AA |

Body ≥ 4.5:1. Large text (≥24px, or ≥18.66px bold) and UI boundaries ≥ 3:1.

### Usage
Roughly 60% surface, 30% surface-raised, 10% accent. Where the accent is allowed,
and where it is not.

## 2. Type

**Display:** <Family>, <weights>. **Text:** <Family>, <weights>.

| Token | Clamp | Min → Max | Tracking | Line height | Use |
|---|---|---|---|---|---|
| `--text-display` | `clamp(2.5rem, 1.2rem + 5.5vw, 5rem)` | 40 → 80 | -0.02em | 0.95 | Page hero, one per page |
| `--text-h2` | `clamp(1.75rem, 1.1rem + 2.6vw, 3rem)` | 28 → 48 | -0.01em | 1.1 | Section headings |
| `--text-h3` | `clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)` | 20 → 24 | 0 | 1.25 | Card and item titles |
| `--text-body` | `clamp(1rem, 0.96rem + 0.2vw, 1.125rem)` | 16 → 18 | 0 | 1.7 | Body copy |
| `--text-small` | `0.875rem` | 14 | 0 | 1.5 | Captions, meta |
| `--text-eyebrow` | `0.75rem` | 12 | 0.2em uppercase | 1 | Section labels |

- Scale ratio: <1.2 / 1.25 / 1.333>
- Measure: 60–75 characters for body copy
- Never below 14px for body text on mobile, 12px for meta

## 3. Space

Base unit 8px. Fluid where it should breathe:

| Token | Value | Use |
|---|---|---|
| `--spacing-section` | `clamp(4rem, 2rem + 8vw, 8rem)` | Vertical padding on every section band |
| `--spacing-gutter` | `clamp(1.25rem, 0.5rem + 3vw, 5rem)` | Page horizontal padding |
| `--spacing-block` | `2rem` | Heading block → content |
| `--spacing-item` | `1.5rem` | Between grid items |

Rhythm: heading → body `0.75rem`; body → next heading `2.5rem`; section → section `--spacing-section`.

## 4. Grid and breakpoints

| Breakpoint | Width | Container | Gutter | Columns |
|---|---|---|---|---|
| Mobile | 390 | fluid | 20 | 1 |
| Tablet | 768 | fluid | 32 | 2 |
| Desktop | 1440 | 1280 max | 80 | 3–4 |

**Deliberate grid breaks:** <where, and why> — one or two per page.

## 5. Motion

| What | Duration | Easing |
|---|---|---|
| Hover / focus state | 150ms | ease-out |
| Disclosure (accordion, menu) | 200ms | ease-out |
| Page-level transition | 300ms | ease-in-out |

Everything inside `@media (prefers-reduced-motion: reduce)` collapses to instant.
Nothing animates the hero headline or hero image — it delays the largest paint.

## 6. Components

| Property | Policy |
|---|---|
| Radius | `2px` on surfaces; `full` on pills and buttons. Nothing in between. |
| Borders | 1px hairline at `--color-border`. Cards get a border **or** a raised surface, never both. |
| Shadow | None, except a modal/dialog scrim. Elevation comes from surface tone. |
| Icons | <set>, 1.5px stroke, 20px or 24px only |
| Images | Aspect ratios: 16/9 hero, 4/3 grid, 3/4 portrait. One consistent grade. |
| Focus | 2px `--color-accent` outline, 3px offset, on `:focus-visible` |
| Tap target | 44px minimum on anything interactive |

## 7. Voice

Headline length limits, sentence case vs title case, how CTAs are worded
("Plan your event", not "Learn more"), what is never said.
```

---

## Method notes

### Building the type scale

Pick a base (16 or 17px) and a ratio, then generate rather than choosing sizes by eye:

```
16 · 1.25⁰ = 16    body
16 · 1.25¹ = 20    h3
16 · 1.25² = 25    h2-small
16 · 1.25³ = 31    h2
16 · 1.25⁵ = 49    display-min
```

Then convert each to a `clamp()` with the mobile value as the minimum and the desktop value as the maximum. The linear middle term:

```
slope      = (maxPx - minPx) / (maxViewport - minViewport)
intercept  = minPx - slope · minViewport
clamp(minRem, intercept/16 rem + slope·100 vw, maxRem)
```

For 40px at 390 to 80px at 1440: slope = 40/1050 = 0.0381 → `3.81vw`; intercept = 40 − 0.0381·390 = 25.1px = 1.57rem. So `clamp(2.5rem, 1.57rem + 3.81vw, 5rem)`.

Six steps is plenty. A scale with eleven steps means half of them are unused and the other half are indistinguishable.

### Measuring contrast

The WCAG ratio is `(L1 + 0.05) / (L2 + 0.05)` on relative luminance. Use a checker rather than intuition — dark navy on gold and mid-grey on white both routinely surprise people.

```bash
python3 - <<'PY'
def lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return round((la + 0.05) / (lb + 0.05), 2)

for fg, bg, use in [('#F4F6FB', '#0B1733', 'body'), ('#A8B4D0', '#0B1733', 'muted')]:
    print(f'{use:12} {fg} on {bg}: {ratio(fg, bg)}:1')
PY
```

For text over a photograph, measure against the **darkest point the scrim reaches**, not the average. An average that passes hides a paragraph that does not.

### Tokens in the `.pen` file and in code

Set the tokens as `.pen` document variables (`SetVariables`) and reference them with `$name` on every node. Then the same names appear in `@theme` in `global.css`. One vocabulary across design and code means a token change is one edit in each place, and a design review can name what is wrong.

A hex code that appears on the canvas but not in the token table is a bug in the design, not a detail. Catch it with a pass over the canvas before handoff.
