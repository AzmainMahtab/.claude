---
description: Produce wireframes or mockups for a product from its PRD — low-fidelity for a proposal, or a full design system when the build is approved.
argument-hint: <project-dir> [page names]
---

# Wireframes — $ARGUMENTS

Design work runs through the existing workspace practice. Do not invent a second one.

## First, ask which of these is wanted

**Low-fidelity, for a proposal.** Block-level page specs plus a simple structural diagram per screen. Enough for the client to see the shape and for the estimate to be honest about screen count. Roughly a tenth of the cost of a design system, and the right answer before a contract is signed.

**Full design system, for the build.** `/design-new` end to end: reference research, tokens with a measured contrast table, canvas in Pencil, `DESIGN-GUIDELINES.md`, and a per-page spec at 390/768/1440 with a component inventory.

Quoting the second when the client wanted the first is the most common way to lose a proposal on price.

## Either way

- [ ] Read `.project-doc/docs/PRD.md` §3 (users), §4 (scope), §6 (journeys), §10 (design direction) first. A wireframe that does not match the journeys is decoration.
- [ ] Output goes to `.project-doc/design/` — `DESIGN-GUIDELINES.md` and `pages/<page>.md`. Never a second design location.
- [ ] Every element belongs to a named component in the page's Component Inventory. No orphan pixels.
- [ ] Responsive is specified at 390 / 768 / 1440, not inferred.

## Low-fidelity route

- [ ] One `.md` per screen: section stack top to bottom, what each section contains, what is interactive, what it links to, and the responsive behaviour in a sentence per breakpoint.
- [ ] A screen inventory table — screen, user type, journey it serves, PRD requirement it implements.
- [ ] Feed the screen count straight into `plan/WBS.md`. Screens are the most reliable estimating unit a UI project has.

## Full design route

- [ ] `/design-new`, executed by the `designer` agent.
- [ ] `design-reviewer` before anything goes to code — token discipline, measured contrast, component traceability, responsive completeness, anti-slop.
- [ ] Design becomes Phase 1 of the delivery plan with its own approval gate. Never schedule build work against unapproved design.
