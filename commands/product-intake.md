---
description: Ingest client context — minutes, notes, briefs — into a project's records and produce the batched clarifying-question list.
argument-hint: <project-dir> [paths to source material]
---

# Intake — $ARGUMENTS

Load the `product-discovery` skill; read `references/intake-protocol.md`. Use the `requirements-analyst` agent.

Use this when new material arrives — a follow-up call, a revised brief, a feature list over email — for a project that already exists. For a brand-new project use `/product-new`.

- [ ] Copy every source into `.project-doc/context/raw/` **verbatim**, named `YYYY-MM-DD-<type>-<topic>.md`. Never edit or paraphrase into that folder.
- [ ] Index each in `context/SOURCES.md` with date, type, participants, and what was extracted.
- [ ] Extract four separate lists: **Facts**, **Requirements** (source-tagged), **Wishes**, **Constraints**. Do not merge them.
- [ ] Update `context/BUSINESS.md` and `context/STAKEHOLDERS.md`.
- [ ] Run the gap checklist across business, users, scope, delivery, non-functional.
- [ ] Write the batched question list to `memory/OPEN_QUESTIONS.md` — grouped by theme, each **Blocking** or **Non-blocking**, every non-blocking item carrying a proposed answer and the cost of changing it later.
- [ ] Flag contradictions between sources with both tags. Do not silently pick one.
- [ ] If this material changes scope, say so explicitly and name what it does to `docs/SCOPE.md`, the estimate and the price.

Report: the outcome in one measurable sentence, requirement count by area, the three biggest gaps, contradictions found, and whether anything here is a scope change.
