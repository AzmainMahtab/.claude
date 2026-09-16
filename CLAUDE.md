# MTNS Academy — Claude Workflow

## Project Layout

```
repo/
├── mtns-academy-backend/   # FastAPI modular monolith (Python 3.14+, uv)
├── mtns-academy-frontend/  # React 19 SPA (Vite, TanStack Router/Query, shadcn)
├── go-kit/                 # Go modular monolith starter kit (Hexagonal + DDD + CQRS)
├── nest-kit/               # NestJS modular monolith starter kit (Hexagonal + DDD + CQRS)
├── <name>-web/             # Astro sites — marketing/content. Design records in .claude-project/design/
├── <project>/              # Client products — records in .project-doc/, scaffolded by /product-new
└── graphify-out/           # Knowledge graph — check this first on any task
```

Authoritative architecture rules live next to the code. Always read the relevant one before touching it:

| Codebase | Rules file |
|----------|------------|
| `mtns-academy-backend/` | `mtns-academy-backend/AGENTS.md` |
| `go-kit/` | `go-kit/AGENTS.md` |
| `nest-kit/` | `nest-kit/AGENTS.md` |

Per-stack detail lives in its own file, imported below: `FASTAPI.md`, `REACT.md`, `GO-KIT.md`, `NEST-KIT.md`.

---

## Graphify — MANDATORY First Step on Every Task

Before touching any file or writing any code, run the graph. No exceptions.

```bash
# Step 1 — orient yourself (always do this first):
cat graphify-out/GRAPH_REPORT.md

# Step 2 — query what's relevant to the task:
graphify query "<what you're about to build or change>"       # BFS — broad discovery
graphify query "<specific concept>" --dfs                      # DFS — trace a dependency chain
graphify path "NodeA" "NodeB"                                  # shortest path between two things
```

This tells you: what already exists, what depends on what, where to plug in, and what you'll break.
Only after running the graph should you read files or write code.

Key god nodes (most connected): `User`, `LoginUseCase`, `RegisterUserUseCase`, `IEventBus`, `InMemoryUserRepository`, `UserStatus`.

The graph does **not** cover `nest-kit/` — see `NEST-KIT.md` for what to read instead.

---

## Product Discovery & Delivery Planning (every new project)

@PRODUCT.md

---

## Backend Stack

@FASTAPI.md

---

## Frontend Stack

@REACT.md

---

## Astro Sites (any `*-web/` marketing or content site)

@ASTRO.md

---

## Design Practice (all projects)

@DESIGN.md

---

## Go Kit Stack (`go-kit/`)

@GO-KIT.md

---

## Nest Kit Stack (`nest-kit/`)

@NEST-KIT.md

---

## Which Agent to Reach For

| Task | Agent |
|------|-------|
| New client, new product, meeting minutes → PRD, estimate, quote | `/product-manager` |
| Reading raw client material into a structured context | `/requirements-analyst` |
| Writing or revising a PRD | `/prd-writer` |
| Estimating delivery time for AI-native work | `/delivery-estimator` |
| Producing a client quotation | `/quote-builder` |
| Build documentation an AI engineer starts from | `/engineering-handoff` |
| Architectural decisions, new module design, event bus wiring | `/architect` |
| Any FastAPI feature, use case, endpoint, migration | `/fastapi-coder` |
| Any Go / go-kit context, use case, endpoint, adapter, migration | `/go-coder` |
| Any NestJS / nest-kit context, use case, endpoint, adapter, migration | `/nest-coder` |
| Any frontend component, route, form, query | `/react-coder` |
| Any Astro page, section, island, content collection, or SEO/perf work | `/astro-coder` |
| Lighthouse score below 100, or a perf/a11y/SEO audit of an Astro page | `/astro-auditor` |
| Any visual design — page, system, redesign, reference research | `/designer` |
| Design review before handing a design to code | `/design-reviewer` |
| PR review before merging | `/code-reviewer` |
| PR review of nest-kit specifically | `/nest-code-reviewer` |
| Auth, token, or injection audit | `/security-reviewer` |
| Auth, token, or RBAC audit of nest-kit specifically | `/nest-security-reviewer` |

---

## Project Records — read before starting, update as you go

Every project keeps its durable, agent-readable records in one directory:

- **`.claude-project/`** if it exists — this is the preferred location.
- **`.project-doc/`** otherwise. Create it when a project has neither.

Never invent a third location and never maintain both. Everything inside is
plain Markdown (or plain YAML/JSON for data) and **harness-agnostic**, so Claude
Code, opencode, Cursor, Aider and a human editor can all use it. No tool-specific
formats, no "as Claude I…" phrasing.

Standard layout: `context/`, `docs/`, `memory/` (DECISIONS, LEARNINGS,
PREFERENCES), `plan/`, `status/`, `agents/`.

These files are **input and output**. Read `docs/PROJECT_KNOWLEDGE.md`,
`status/`, and `memory/DECISIONS.md` before starting; update `status/` and
`memory/` as work lands. Stale status is worse than none.

A root-level `AGENTS.md` should point at the records directory so non-Claude
harnesses find it too.

---

## Cross-Cutting Rules

- NEVER add comments unless asked
- NEVER create README/documentation files unless asked
- NEVER commit unless asked
- Preserve existing naming conventions (see the relevant `AGENTS.md`)
- Run the stack's quality gate before finishing — each stack file names its own
- **Always**: graphify first → read files second → write code third
- **Astro sites**: never build a page without `DESIGN-GUIDELINES.md` and its page spec — run `/design-new` first
- **Every design** produces `DESIGN-GUIDELINES.md` + a per-page spec with a component inventory and 390/768/1440 behaviour
- Update the project's `.claude-project/` or `.project-doc/` records as work lands
