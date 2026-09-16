---
description: Write or revise the PRD for a project from its context and work breakdown, and export it to Markdown and PDF.
argument-hint: <project-dir>
---

# PRD — $ARGUMENTS

Load the `product-discovery` skill; follow `references/prd-template.md`. Use the `prd-writer` agent.

## Inputs — refuse to start without them

- [ ] `context/BUSINESS.md`, `context/STAKEHOLDERS.md`, `context/raw/`
- [ ] `plan/WBS.md`
- [ ] `docs/SCOPE.md` — **if its out-of-scope list is empty, stop.** The scope has not been understood, and a PRD built on that is wrong in the expensive direction.

## Write

- [ ] All 15 sections. A section that does not apply is deleted with a one-line note, never left as "N/A".
- [ ] Front matter intact — it builds the PDF cover.
- [ ] Every requirement traces to `context/raw/` or appears in §13 Assumptions.
- [ ] Two acceptance criteria minimum per functional requirement, one an edge or failure case.
- [ ] No "fast", "modern", "seamless", "user-friendly", "robust" — numbers or nothing.
- [ ] The client's vocabulary throughout; the mapping in `docs/GLOSSARY.md`.

## Check

- [ ] Read §5 as a stranger. Any requirement you could not implement without asking gets answered here or moved to §14.
- [ ] Run the quality bar at the end of the reference as a checklist.

## Export

```bash
python3 .claude/skills/product-discovery/scripts/md2pdf.py \
  .project-doc/docs/PRD.md .project-doc/deliverables/PRD.pdf
```

- [ ] Copy `.md` and `.pdf` to `~/Documents/<project>/`.
- [ ] If this is a revision, bump the version in the front matter and add a line to `status/CHANGELOG.md`.
- [ ] If scope moved, re-run `/product-quote`. A PRD and a quotation that disagree is a dispute waiting to happen.
