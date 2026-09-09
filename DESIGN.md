Design practice for this workspace — how designs are made, recorded, and handed to code. Imported by `CLAUDE.md`.

Designs live in Pencil (`.pen` files, accessed **only** through the `pencil` MCP tools — never `Read`/`Grep` on a `.pen`). Their written record lives in the project's records directory.

## Every design produces two documents. No exceptions.

| File | Location | What it is |
|------|----------|------------|
| `DESIGN-GUIDELINES.md` | `<project>/.claude-project/design/` | The **system**: tokens, type scale, spacing, grid, breakpoints, motion, contrast table, component rules. One per project. Written before the first screen. |
| `<page>.md` | `<project>/.claude-project/design/pages/` | The **spec** for one page: section-by-section, the component inventory, and the responsive behaviour at every breakpoint. One per page. |

A design that exists only on a canvas is not finished. The `.md` is what the Astro agent builds from, what survives the design tool, and what makes a redesign a diff instead of an archaeology project.

## Non-negotiables

- **Responsive is designed, not inferred.** Every page is specified at **390 / 768 / 1440**. Each section spec says what reflows, what stacks, what is dropped, and what the type scale does. "It'll be responsive" is not a spec.
- **Everything traces to a component.** No orphan pixels. Every element in a design belongs to a named component that appears in the page's Component Inventory table with its intended code path. If it cannot be named, it should not be drawn.
- **Tokens before pixels.** Colour, type, spacing and radius are named variables in the `.pen` file and in `DESIGN-GUIDELINES.md`. A hex code that appears in a design but not in the token table is a bug.
- **Contrast is checked at token time.** Every foreground/background pair that ships gets a measured ratio in the guidelines table — ≥4.5:1 for body, ≥3:1 for large text and UI boundaries. This is how the build scores 100 on accessibility without a rework pass.
- **Reference research is cited.** When the user names reference sites, the design doc records what was taken from each and why — not "inspired by", but the specific structural or typographic decision.
- **Elegance is restraint.** One accent colour. Two typefaces at most. Real whitespace. Asymmetry over centred-everything. See the skill's anti-slop rules — they exist because the default AI design is a grid of identical rounded cards, and that is what we are not shipping.

Use `/design` (skill) for the process, `/designer` (agent) to produce a design, `/design-new` (command) for a whole new page or project system, `/design-reviewer` (agent) before handing anything to code.
