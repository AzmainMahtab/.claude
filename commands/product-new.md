---
description: Start a new product from client context — scaffold the repo, run discovery, and produce the PRD, estimate, quotation and engineering guide end to end.
argument-hint: "<Project Name>" [client name]
---

# New Product — $ARGUMENTS

Load the `product-discovery` skill. Drive with the `product-manager` agent. Do not reproduce the templates here — they are in the skill's `references/`.

## Phase 0 — Intake

- [ ] Ask the user for: the **target directory**, the client name, and every piece of context they have (minutes, notes, briefs, feature lists, brand material, competitor links). Do not scaffold until you have the directory.
- [ ] `bash .claude/skills/product-discovery/scripts/scaffold-project.sh <dir> "<Project Name>" "<Client>"`
- [ ] Copy all raw material into `.project-doc/context/raw/` verbatim, named `YYYY-MM-DD-<type>-<topic>.md`. Index it in `context/SOURCES.md`.
- [ ] `requirements-analyst`: extract Facts / Requirements / Wishes / Constraints as four separate lists, each requirement source-tagged. Write `context/BUSINESS.md` and `context/STAKEHOLDERS.md`.

**Gate:** the business outcome being bought is stated in one measurable sentence.

## Phase 1 — Clarify

- [ ] Run the checklist in `references/intake-protocol.md` §3.
- [ ] One batched question list, grouped by theme, each item **Blocking** or **Non-blocking**, every non-blocking item carrying your proposed answer. Write to `memory/OPEN_QUESTIONS.md` and put it to the user.
- [ ] Proceed on stated assumptions for the non-blocking ones. Record each in PRD §13.

**Gate:** every blocking question answered — or the engagement is re-scoped as a paid discovery phase.

## Phase 2 — Decompose

- [ ] `plan/WBS.md`: capabilities → epics → stories → tasks. A task is one agent session: single outcome, own acceptance criteria, 2–8 traditional hours.
- [ ] Tag every task with its **work type** from the multiplier table. Phase 4 estimates against that tag.
- [ ] `docs/SCOPE.md`: in-scope MoSCoW, out-of-scope, deferred. Write the out-of-scope list now, while the client's wishes are fresh.

## Phase 3 — Specify

- [ ] `prd-writer` → `docs/PRD.md` from `references/prd-template.md`, front matter included.
- [ ] Run the quality bar at the end of that reference as a checklist. No unquantified adjectives; two acceptance criteria minimum per requirement, one a failure case.
- [ ] `python3 .claude/skills/product-discovery/scripts/md2pdf.py .project-doc/docs/PRD.md .project-doc/deliverables/PRD.pdf`
- [ ] Copy the `.md` and `.pdf` to `~/Documents/<project>/`.

**Gate:** client approves the PRD. Do not price or build an unapproved scope.

## Phase 4 — Estimate

- [ ] `delivery-estimator` → `plan/ESTIMATE.md`: baseline hours, per-task multiplier, itemised buffer, calendar with approval gates, and the three named risks most likely to blow it.
- [ ] Check the total against the sanity tiers. Outside a tier: justify explicitly or redo.
- [ ] `plan/ROADMAP.md`.

## Phase 5 — Price

- [ ] `quote-builder` → `commercial/QUOTATION.md` + `commercial/ASSUMPTIONS.md` at $70/hr blended, fixed price per phase, rounded down.
- [ ] Exclusions named concretely; client dependencies dated; payment schedule set.
- [ ] Export `deliverables/QUOTATION.pdf`, copy both formats to `~/Documents/<project>/`.

**Gate:** client signature before build work starts.

## Phase 6 — Hand off

- [ ] `engineering-handoff` (+ `architect` for stack): `docs/PROJECT_KNOWLEDGE.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `GLOSSARY.md`, `plan/BACKLOG.md`.
- [ ] Prefer an existing workspace kit — `nest-kit/`, `go-kit/`, `mtns-academy-backend/`, React 19 + TanStack, Astro 5. Log any deviation in `memory/DECISIONS.md`.
- [ ] `status/CURRENT.md` updated. `memory/DECISIONS.md` has an entry per real decision.

**Gate:** a stranger can read `PROJECT_KNOWLEDGE.md` and start the top backlog item without asking a question.

## Design — only if asked

Run `/product-wireframes` or `/design-new`. Never plan build work in parallel with unapproved design.

## Report

A few plain sentences: hours, weeks, price, the assumptions that matter, and the one thing you need from the user next.
