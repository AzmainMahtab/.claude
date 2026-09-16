---
description: Produce or reissue the delivery estimate and the fixed-price quotation for a project, in Markdown and PDF.
argument-hint: <project-dir>
---

# Estimate & Quote — $ARGUMENTS

Load the `product-discovery` skill. `delivery-estimator` then `quote-builder`. Numbers from `references/estimation-model.md` and `references/rate-card.md` — never from memory.

## Estimate

- [ ] Every `plan/WBS.md` leaf task gets a **baseline** in hours: a senior engineer, by hand, no AI. Count, do not feel.
- [ ] Apply the **multiplier per task** by work type. Blend outside 0.42–0.55× means recheck — you have probably under-counted discovery, integration or QA.
- [ ] **Buffer, itemised** by condition with its percentage. +10% baseline always, capped at +45%. Past the cap, recommend a paid discovery phase instead of a build quote.
- [ ] **Calendar**: 30 h/engineer-week, PM overhead on top, 3 business days per approval gate marked on the timeline.
- [ ] Sanity-tier check. Outside its tier: justify explicitly or redo.
- [ ] `plan/ESTIMATE.md` + `plan/ROADMAP.md`, including the three named things most likely to blow the estimate.

## Quote

- [ ] $70/hr blended unless a listed situation applies — and if it does, record why in `commercial/ASSUMPTIONS.md`.
- [ ] Phase prices to the nearest $50; total rounded **down** to a clean figure.
- [ ] Payment schedule: 30/40/30 default; two 20% milestones in the middle above $35k; 50/50 for a first-time client under $8k.
- [ ] Three price points if the budget is unknown — reduced, recommended, extended.
- [ ] Exclusions named concretely. Client dependencies in a dated table. 30-day defect window defined against the PRD. Change requests at $70/hr, 2-hour minimum. Validity 30 days. IP on final payment.
- [ ] Care plan and retainer offered and priced.
- [ ] `commercial/QUOTATION.md` + `commercial/ASSUMPTIONS.md`, cross-referenced to PRD §13.

## Export

```bash
python3 .claude/skills/product-discovery/scripts/md2pdf.py \
  .project-doc/commercial/QUOTATION.md .project-doc/deliverables/QUOTATION.pdf
```

- [ ] Copy both formats to `~/Documents/<project>/`.

## Rules

- Every figure in the quotation traces to a row in the estimate. Regenerate, never hand-patch.
- The multiplier and the traditional baseline never appear in the client document.
- Reissuing after a scope change: bump the version, note what moved and why in `status/CHANGELOG.md`, and state the delta against the previous quote in plain terms.

Report: total hours, weeks, price, phase split, and the exclusion most likely to be challenged.
