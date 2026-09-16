---
name: product-discovery
description: Use when starting a new product from client context — business details, meeting minutes, meeting notes, a brief, a feature list, or a discovery call — and you need to turn it into a delivery-ready project. Covers intake and clarifying questions, scope decomposition, a PRD in Markdown and PDF, an AI-native time estimate, a fixed-price quotation at international mid-market rates, the engineering guide an AI-native developer builds from, and a scaffolded repo with a model-agnostic .project-doc/ records directory. Triggers on "new project", "new client", "PRD", "proposal", "quotation", "estimate this", "scope this", "meeting minutes", "product brief".
---

# Product Discovery

Turning a pile of client context into a repo an AI-native engineer can start on Monday.

The premise: **the deliverable of discovery is not a document, it is a buildable, priced, decomposed project.** A PRD nobody can estimate is an essay. An estimate with no scope boundary is a wish. A repo with no records is where the context goes to die the moment the session ends. This skill produces all three as one artefact set, in a directory that any AI model or human can read.

Companion references — read the one you need, do not reproduce it:

| File | For |
|---|---|
| `references/intake-protocol.md` | Reading raw client material; the clarifying-question checklist |
| `references/prd-template.md` | The PRD, section by section, with the quality bar |
| `references/estimation-model.md` | Baseline hours → AI-native multiplier → buffer → calendar, with sanity tiers |
| `references/rate-card.md` | 2026 international rates, our position, fixed-price construction, payment terms |
| `references/quotation-template.md` | The client-facing commercial document |
| `references/engineer-guide-template.md` | `PROJECT_KNOWLEDGE.md`, the first file any agent reads |

Scripts:

```bash
S=".claude/skills/product-discovery/scripts"
bash $S/scaffold-project.sh <target-dir> "<Project Name>" "<Client Name>"
python3 $S/md2pdf.py <in.md> <out.pdf>          # front matter drives the cover page
```

---

## The pipeline

Seven phases. Each has a gate; do not walk past a gate because the next phase looks more interesting.

```
0 Intake        raw material in, sources indexed, nothing interpreted yet
1 Clarify       the questions asked before anything is assumed        [GATE: answers or stated assumptions]
2 Decompose     capabilities → epics → stories → tasks
3 Specify       the PRD                                               [GATE: client approval]
4 Estimate      hours, calendar, risk
5 Price         fixed-price quotation                                 [GATE: client signature]
6 Hand off      engineering guide, architecture, backlog, repo
```

Design, when asked for, runs between 3 and 6 — see **Design** below.

### Phase 0 — Intake

Ask for the target directory before creating anything; do not assume a location.

```bash
bash .claude/skills/product-discovery/scripts/scaffold-project.sh <dir> "<Name>" "<Client>"
```

Copy every piece of raw client material into `.project-doc/context/raw/` verbatim, named `YYYY-MM-DD-<type>-<topic>.md`, and index it in `context/SOURCES.md`. Then extract facts, requirements, wishes and constraints as four separate lists — `references/intake-protocol.md` §2 explains why collapsing them is the mistake that costs you a project.

Write `context/BUSINESS.md` and `context/STAKEHOLDERS.md`.

**Gate:** you can state the business outcome being bought, in one measurable sentence.

### Phase 1 — Clarify

Run the checklist in `references/intake-protocol.md` §3 against the extracted material. Produce one batched list, grouped by theme, each item marked **Blocking** or **Non-blocking**, and every non-blocking item carrying your proposed answer so confirming is cheaper than deliberating.

Put the list in `memory/OPEN_QUESTIONS.md` and give it to the user. Do not stall the whole pipeline on non-blocking answers: proceed under explicitly stated assumptions and record each one in PRD §13.

**Gate:** every blocking question is answered, or the project is re-scoped as a paid discovery phase.

### Phase 2 — Decompose

Capabilities → epics → stories → tasks, into `plan/WBS.md`. A task is right-sized when it is **one agent session**: a single clear outcome, its own acceptance criteria, testable on its own, and roughly 2–8 hours of traditional effort.

Tag each task with its work type from the multiplier table — that tag is what Phase 4 estimates against, so it is not optional metadata.

Write `docs/SCOPE.md` at the same time: in-scope MoSCoW, out-of-scope, deferred. Write the out-of-scope list while the client's wishes are fresh; it is much harder to reconstruct later, and it is the section that prevents disputes.

### Phase 3 — Specify

Write `docs/PRD.md` from `references/prd-template.md`. Delegate to the `prd-writer` agent for the draft; review it yourself against the quality bar at the end of that reference before anyone else sees it.

Export:

```bash
python3 .claude/skills/product-discovery/scripts/md2pdf.py \
  .project-doc/docs/PRD.md .project-doc/deliverables/PRD.pdf
```

Also copy the PDF and the Markdown to `~/Documents/<project>/` — that is where the user keeps client-facing documents.

**Gate:** client approves the PRD. Do not price an unapproved scope, and do not build one.

### Phase 4 — Estimate

`references/estimation-model.md`, in full, into `plan/ESTIMATE.md`. Baseline hours per task, multiplier per work type, itemised buffer, calendar with approval gates on it, and the named three things most likely to blow the estimate.

Check the total against the sanity tiers before going further. Outside a tier means either genuinely unusual scope — say so explicitly — or a broken estimate.

Then `plan/ROADMAP.md`: phases, milestones, what the client sees at the end of each.

### Phase 5 — Price

`references/rate-card.md` + `references/quotation-template.md` → `commercial/QUOTATION.md` and `commercial/ASSUMPTIONS.md`. Blended $70/hr, fixed price per phase, rounded down, payment schedule, exclusions named concretely, client dependencies dated.

Export to PDF the same way. Every number traces to a row in `plan/ESTIMATE.md`; the multiplier and the traditional baseline never appear in the client document.

### Phase 6 — Hand off

`docs/PROJECT_KNOWLEDGE.md` from `references/engineer-guide-template.md`, plus `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `GLOSSARY.md`, and `plan/BACKLOG.md` — the ordered, unblocked, one-session-per-item task list.

For stack choice, consult the `architect` agent and prefer a starter kit that already exists in this workspace: `nest-kit/` (NestJS), `go-kit/` (Go), `mtns-academy-backend/` (FastAPI) as the backend pattern, React 19 + TanStack for app frontends, Astro 5 for marketing sites. Adopting one converts weeks of foundation work into hours — and if you deviate, `memory/DECISIONS.md` must say why.

**Gate:** a competent stranger can open the repo, read `PROJECT_KNOWLEDGE.md`, and start the top backlog item without asking a question.

---

## Design

Only when asked. Wireframes and mockups run through the existing workspace tooling — do not invent a second design practice:

- `/design-new` for a whole page or a project design system.
- `designer` agent to produce it; `design-reviewer` before it goes to code.
- Output lands in `.project-doc/design/DESIGN-GUIDELINES.md` and `.project-doc/design/pages/<page>.md`, specified at 390/768/1440.

Low-fidelity wireframes for a proposal are a different thing from a design system: for a pitch, a section-by-section page spec plus a simple block diagram is usually enough, and it costs a tenth as much. Ask which one is wanted before starting.

When design is in scope, it becomes Phase 1 of the delivery plan and it carries an approval gate. Never plan build work in parallel with unapproved design.

## Agents

| Phase | Agent |
|---|---|
| Whole pipeline | `product-manager` |
| 0–1 | `requirements-analyst` |
| 2–3 | `prd-writer` |
| 4 | `delivery-estimator` |
| 5 | `quote-builder` |
| 6 | `engineering-handoff`, with `architect` for stack choice |
| Design | `designer`, `design-reviewer` |

## Rules

- **Nothing is invented.** Every requirement traces to a source in `context/raw/`, or it is an assumption and labelled as one in PRD §13.
- **The records are model-agnostic.** Plain Markdown, no harness-specific formats, no "as Claude I…". Codex, Cursor, Gemini, Aider and a human all read `.project-doc/` the same way.
- **Absolute dates**, always. "Next sprint" is meaningless in a file read six months later.
- **Ask rather than assume on anything that moves the price or the date.** Everything else: assume, state the assumption, and keep moving.
- **Both formats, every client-facing document.** `.md` in the repo is canonical; `.pdf` in `deliverables/` and `~/Documents/<project>/` is what gets sent.
- **Regenerate, never patch.** A changed scope means re-run Phases 4 and 5. Hand-editing a PDF figure is how a quotation stops matching its estimate.
