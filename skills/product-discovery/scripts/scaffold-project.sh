#!/usr/bin/env bash
# Scaffold a product repo with a model-agnostic .project-doc/ records directory.
# Usage: scaffold-project.sh <target-dir> "<Project Name>" ["<Client Name>"]
set -euo pipefail

DIR="${1:?target directory required}"
NAME="${2:?project name required}"
CLIENT="${3:-}"
SLUG="$(printf '%s' "$NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g')"
TODAY="$(date +%Y-%m-%d)"

if [ -e "$DIR/.project-doc" ]; then
  echo "refusing to overwrite: $DIR/.project-doc already exists" >&2; exit 1
fi

mkdir -p "$DIR"/.project-doc/{context/raw,docs,design/pages,plan,commercial,memory,status,deliverables}

seed() { # seed <path> <title> <one-line purpose>
  local p="$DIR/.project-doc/$1"
  [ -e "$p" ] && return 0
  printf '# %s\n\n> %s\n>\n> Status: TEMPLATE — not yet written.\n\n_Last updated: %s_\n' "$2" "$3" "$TODAY" > "$p"
}

seed context/BUSINESS.md      "Business Context"        "Who the client is, what they sell, who they sell to, and what success means commercially."
seed context/STAKEHOLDERS.md  "Stakeholders"            "Every named person, their role, what they decide, and how to reach them."
seed context/SOURCES.md       "Source Index"            "Every raw input in context/raw/ with its date, type, and what was extracted from it."
seed docs/PRD.md              "Product Requirements"    "The single source of truth for what is being built and why. Canonical."
seed docs/SCOPE.md            "Scope Boundary"          "MoSCoW in-scope list, the explicit out-of-scope list, and the deferred list."
seed docs/PROJECT_KNOWLEDGE.md "Engineering Guide"      "Everything an AI-native engineer needs before writing the first line. Read this first."
seed docs/ARCHITECTURE.md     "Architecture"            "Stack decision, module boundaries, dependency rules, and the reasoning behind each."
seed docs/DATA_MODEL.md       "Data Model"              "Entities, fields, relationships, invariants, and lifecycle states."
seed docs/API_CONTRACT.md     "API Contract"            "Every endpoint: method, path, auth, request, response, error codes."
seed docs/GLOSSARY.md         "Glossary"                "Domain terms in the client's own words, defined once."
seed plan/WBS.md              "Work Breakdown"          "Epics to stories to tasks, each independently estimable and independently shippable."
seed plan/ESTIMATE.md         "Delivery Estimate"       "Hours per task with the AI-native multiplier applied, plus risk buffer and calendar."
seed plan/ROADMAP.md          "Roadmap"                 "Phases, milestones, dependencies, and what the client sees at the end of each."
seed plan/BACKLOG.md          "Execution Backlog"       "The ordered, AI-executable task list. One task = one agent session."
seed commercial/QUOTATION.md  "Quotation"               "Fixed price per phase, payment schedule, and what is excluded."
seed commercial/ASSUMPTIONS.md "Commercial Assumptions" "Every assumption the price depends on. If one breaks, the price changes."
seed memory/DECISIONS.md      "Decision Log"            "Dated, numbered decisions: context, options, choice, consequence. Append-only."
seed memory/LEARNINGS.md      "Learnings"               "What surprised us. Written when it happens, not at the end."
seed memory/PREFERENCES.md    "Client Preferences"      "How this client likes to work, review, and be communicated with."
seed memory/OPEN_QUESTIONS.md "Open Questions"          "Unanswered questions, who owns each, and what is blocked until it is answered."
seed status/CURRENT.md        "Current Status"          "Where the project is right now. Stale status is worse than none."
seed status/CHANGELOG.md      "Changelog"               "Dated record of what shipped and what changed in scope."

cat > "$DIR/.project-doc/README.md" <<DOC
# .project-doc — $NAME

Durable, harness-agnostic project records. Plain Markdown. No tool-specific
formats, no "as Claude I…" phrasing. Claude Code, Codex, Cursor, Aider, Gemini,
opencode and a human editor all read this directory the same way.

## Reading order for any agent or engineer

1. \`docs/PROJECT_KNOWLEDGE.md\` — the engineering guide. Start here, always.
2. \`docs/PRD.md\` — what is being built and why.
3. \`docs/SCOPE.md\` — what is explicitly *not* being built.
4. \`plan/BACKLOG.md\` — the next task to pick up.
5. \`memory/DECISIONS.md\` — why the code looks the way it does.
6. \`status/CURRENT.md\` — where things stand today.

## Writing rules

- Every file is **input and output**. Read before starting; update as work lands.
- Dates are absolute (\`2026-09-10\`), never relative ("last week").
- \`memory/DECISIONS.md\` is append-only. Supersede a decision with a new one; never edit history.
- \`docs/PRD.md\` is canonical. If code and PRD disagree, one of them is a bug — say which.
- Raw client material goes in \`context/raw/\` verbatim and is never edited. Interpretation goes in \`context/BUSINESS.md\`.
- Generated PDFs live in \`deliverables/\` and are rebuilt, never hand-edited.

## Directory map

| Path | Holds |
|------|-------|
| \`context/\` | Business reality and the raw client inputs it was derived from |
| \`docs/\` | The PRD and the engineering-facing specifications |
| \`design/\` | \`DESIGN-GUIDELINES.md\` and one spec per page |
| \`plan/\` | Work breakdown, estimate, roadmap, execution backlog |
| \`commercial/\` | Quotation and the assumptions it depends on |
| \`memory/\` | Decisions, learnings, preferences, open questions |
| \`status/\` | Current state and changelog |
| \`deliverables/\` | Generated PDFs — PRD, quotation |
DOC

cat > "$DIR/AGENTS.md" <<DOC
# $NAME

${CLIENT:+Client: $CLIENT}

**Before doing anything, read \`.project-doc/docs/PROJECT_KNOWLEDGE.md\`.**
It is the engineering guide and it names every other document you need.

All durable project records live in \`.project-doc/\`. That directory is the
contract between the humans, the AI agents, and whatever harness runs them.
See \`.project-doc/README.md\` for the map and the reading order.

## Working rules

- Read \`.project-doc/docs/SCOPE.md\` before adding anything. Out-of-scope work is a change request, not a favour.
- Take the next task from \`.project-doc/plan/BACKLOG.md\`. One task, one session.
- Log every non-obvious choice in \`.project-doc/memory/DECISIONS.md\` the moment you make it.
- Update \`.project-doc/status/CURRENT.md\` when work lands. Do not batch this to the end.
- Anything you could not answer goes in \`.project-doc/memory/OPEN_QUESTIONS.md\` with an owner.
DOC

cat > "$DIR/README.md" <<DOC
# $NAME

${CLIENT:+**Client:** $CLIENT}
**Repository:** \`$SLUG\`
**Created:** $TODAY

Project documentation lives in [\`.project-doc/\`](.project-doc/README.md).
Agents and engineers start at [\`AGENTS.md\`](AGENTS.md).
DOC

echo "scaffolded: $DIR"
find "$DIR" -type f | sort | sed "s|^$DIR/|  |"
