# PRD Template

Copy this into `.project-doc/docs/PRD.md`. Fill every section. A section that does not apply is deleted with a one-line note saying why — never left as a heading with "N/A" under it.

The PRD is written for **two readers at once**: the client, who must recognise their business in it and sign it, and an AI agent, which must be able to build from it without asking a human. That means plain language for the first and unambiguous specificity for the second. When those conflict, put the plain sentence in the body and the specificity in the acceptance criteria.

The front matter block is what `md2pdf.py` uses to build the cover page. Keep it.

```markdown
---
title: <Product Name>
subtitle: <One line: what it is, for whom>
doc-type: Product Requirements Document
client: <Client legal name>
date: <YYYY-MM-DD>
version: v1.0
author: <Your company>
status: For approval
---

## 1. Summary

Three paragraphs, no more.
Paragraph 1: the business problem, in the client's own words and numbers.
Paragraph 2: what we are building.
Paragraph 3: what success looks like and when it is measured.

## 2. Business Context

- **The business:** what they do, who they serve, how they make money.
- **The problem today:** the current process, with the cost of it quantified wherever the client gave a number.
- **Why now:** the trigger. A deadline, a competitor, a growth ceiling, a failing manual process.
- **Business objectives:** three at most, each measurable.

| Objective | Measured by | Baseline today | Target | When |
|---|---|---|---|---|

## 3. Users

One subsection per user type. Primary type first — and say which one is primary, because that decides every design tradeoff.

**<User type>** — <one line on who they are>
- Context of use: device, place, connectivity, frequency, urgency.
- What they do today instead.
- What they need from this product, ranked.
- What would make them abandon it.

## 4. Scope

### In scope — v1

MoSCoW. Must-have means the product is pointless without it.

| # | Capability | Priority | User type | Rationale |
|---|---|---|---|---|

### Out of scope

Explicit, itemised, and phrased so a reader cannot mistake it for an omission. This section prevents more disputes than every other section combined.

### Deferred to a later phase

Things the client asked for that we agree with but are not building now, with the phase they land in.

## 5. Functional Requirements

Grouped by capability area. Every requirement is atomic, testable, and identified.

**FR-<AREA>-<n>: <short name>**
- **As a** <user type> **I need to** <action> **so that** <outcome>.
- **Behaviour:** what the system does, step by step, including what happens when it fails.
- **Rules:** validation, limits, permissions, calculations. Numbers, not adjectives.
- **Acceptance criteria:**
  - [ ] Given <state>, when <action>, then <observable result>.
  - [ ] Given <edge case>, when <action>, then <observable result>.

Requirements an agent cannot test are not requirements. "The dashboard should be fast" is a wish. "The dashboard renders in under 1.5 s on a 4G connection with 500 rows" is a requirement.

## 6. User Journeys

For each primary journey: the entry point, the numbered steps, the success end state, and every branch where it can fail. One journey per critical path — signup, the core action, payment, recovery from error.

## 7. Data

Entities, their fields, their relationships, and their lifecycle states. Include what must never happen (invariants), what is personal data, and what must be retained or deleted on a schedule.

| Entity | Key fields | Relationships | States | Retention |
|---|---|---|---|---|

## 8. Integrations

| System | Direction | What it does | Auth | API exists? | Owner of credentials | Risk |
|---|---|---|---|---|---|---|

"API exists?" is answered `verified` only if someone on our side has seen a response from it. Anything else is `claimed`, and `claimed` carries a risk buffer.

## 9. Non-Functional Requirements

- **Performance:** page load, API response, concurrent users at launch and at month 12.
- **Availability:** target, and what a breach of it means commercially.
- **Security:** authentication model, roles and what each can do, data at rest and in transit, session and token handling.
- **Privacy and compliance:** which regime applies, what it obliges, who is the data controller.
- **Accessibility:** the target standard (default WCAG 2.2 AA) and how it is verified.
- **Browsers and devices:** the supported matrix, stated as a list, not "modern browsers".
- **Localisation:** languages, currencies, date formats, RTL.

## 10. Design Direction

The brand inputs, the intended feel in three adjectives, the reference products and what specifically is taken from each. Points at `.project-doc/design/DESIGN-GUIDELINES.md` and the per-page specs. If design has not started, say so and name the gate it must pass before build begins.

## 11. Release Plan

| Phase | Contains | Client sees | Gate |
|---|---|---|---|

## 12. Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|

Include commercial and client-side risks, not only technical ones. "Client content arrives late" belongs here and is more likely than any of the technical entries.

## 13. Assumptions

Everything the plan depends on that has not been confirmed. Each one is a sentence, numbered, and cross-referenced from the quotation. If an assumption breaks, the price and the date change — and this list is what makes that conversation a process instead of an argument.

## 14. Open Questions

| # | Question | Owner | Blocking? | Needed by |
|---|---|---|---|---|

## 15. Approval

| Name | Role | Approves | Date |
|---|---|---|---|
```

## Quality bar before you send it

- Every "should", "fast", "user-friendly", "modern", "seamless" and "robust" is either deleted or replaced with a number.
- Every functional requirement has at least two acceptance criteria, one of them an edge or failure case.
- The out-of-scope list is not empty. If it is, you have not understood the scope yet.
- A stranger could build from it. Read section 5 as if you had never met the client.
- The client's own vocabulary is used throughout. Their word for a thing beats your word for it, every time — and `docs/GLOSSARY.md` is where you record which is which.
