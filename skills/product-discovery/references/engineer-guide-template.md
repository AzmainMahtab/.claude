# Engineering Guide Template

Copy into `.project-doc/docs/PROJECT_KNOWLEDGE.md`. This is the **first file any engineer or agent reads**, and it must be good enough that a competent stranger — human or model — can open the repo, read this one document, and start work correctly within an hour.

It is not a summary of the PRD. The PRD says *what* and *why*; this says *how, in this repo, with these rules*.

```markdown
# <Project Name> — Engineering Guide

_Last updated: <YYYY-MM-DD>_

## 0. Read this first

You are building <one sentence>. The client is <who>, and the outcome they are paying for is <outcome>.

**Before writing any code:**
1. Read `.project-doc/docs/PRD.md` — sections 4 (scope), 5 (functional requirements), 7 (data).
2. Read `.project-doc/docs/SCOPE.md`. Do not build anything outside it.
3. Read `.project-doc/memory/DECISIONS.md` end to end. It is short and it explains why the code looks the way it does.
4. Take the top unblocked task from `.project-doc/plan/BACKLOG.md`.

**Non-negotiables for this project:** <three to six lines, project-specific>

## 1. Stack

| Concern | Choice | Why this one here |
|---|---|---|

Every row needs the third column. A stack table without reasons gets overruled by the next engineer who has a preference.

## 2. Architecture

The shape in one paragraph, then the directory tree with a one-line purpose per directory, then the dependency rule stated as an arrow and enforced by a check in the quality gate.

    <tree>

**Dependency rule:** `<a> → <b> → <c>`, never backwards. <How it is enforced.>

## 3. Domain model

The entities and how they relate, in the client's vocabulary. Then the invariants — the things that must never be true — because those are what a generated implementation silently breaks.

| Entity | Owns | Invariants |
|---|---|---|

## 4. Conventions

Naming, file layout, error handling, logging, configuration, testing shape. Show one **real** example of each from this repo rather than describing it. An example is copied correctly; a description is interpreted.

## 5. How to build a feature here

The concrete write order for this codebase, as a numbered list, from domain outward to HTTP and UI, with the test that must exist at each step. This section is what makes agent output consistent between sessions — without it, every session invents its own order.

## 6. Environment

    <setup commands, verbatim, copy-pasteable>

Required environment variables, in a table, with where to get each value. Never a secret in this file.

## 7. Quality gate

    <the single command that must pass before any work is called done>

What it runs and what each failure means. Work is not finished until this passes — not "finished except for lint".

## 8. Definition of done

- [ ] Acceptance criteria in the PRD requirement are all met.
- [ ] Tests written and passing, including the failure case.
- [ ] Quality gate green.
- [ ] `.project-doc/status/CURRENT.md` updated.
- [ ] Any non-obvious choice logged in `.project-doc/memory/DECISIONS.md`.
- [ ] No new item in `docs/SCOPE.md` under Out of Scope was implemented.

## 9. Agent guidance

Which agent or skill handles which kind of task in this repo, how to split work so sessions do not collide, and what an agent must never do without asking — schema changes, dependency additions, auth or payment logic, anything touching production data.

## 10. Traps

The specific things that will bite you in this codebase and this domain. Written as they are discovered, never in advance. This section is the highest-value part of the document after month one, and it is empty on day one — that is correct.
```

## Rules

- Written **before** the first line of feature code, updated as the repo teaches you things.
- Concrete over abstract: real paths, real commands, real snippets from this repo.
- If a rule matters, state the consequence of breaking it. Rules without consequences get skipped.
- Keep it under roughly 400 lines. When it grows past that, split the detail into `ARCHITECTURE.md`, `DATA_MODEL.md` and `API_CONTRACT.md` and leave pointers here.
