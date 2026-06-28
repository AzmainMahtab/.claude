# MTNS Academy — Claude Workflow

## Project Layout

```
mtns-academy/
├── mtns-academy-backend/   # FastAPI modular monolith (Python 3.14+, uv)
├── mtns-academy-frontend/  # React 19 SPA (Vite, TanStack Router/Query, shadcn)
└── graphify-out/           # Knowledge graph — check this first on any task
```

Full backend architecture rules live in `mtns-academy-backend/AGENTS.md`. Always read that file before touching backend code.

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

---

## Backend Stack

| Concern | Tool |
|---------|------|
| Language | Python 3.14+, `uv` |
| Framework | FastAPI (async) + Pydantic v2 |
| ORM | SQLAlchemy 2.0 (async) + PostgreSQL |
| Cache / blacklist | Redis |
| Passwords | Argon2id (`passlib[argon2]`) |
| Tokens | PyJWT (HS256) |
| Migrations | Alembic (async) |
| Events | `InMemoryEventBus` (in `app/core/event_bus.py`) |
| Quality | ruff + mypy + pre-commit |

Architecture: **Modular Monolith + Clean Architecture + DDD + CQRS**. Dependency rule: `api/ → use_cases/ → domain/` only. `domain/` has zero framework imports.

---

## Frontend Stack

| Concern | Tool |
|---------|------|
| Framework | React 19 |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + Zod v4 |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| HTTP | axios (`src/lib/api.ts`) |
| Build | Vite 8 + TypeScript 6 |

Routes live under `src/routes/`. Auth-gated routes are nested inside `_authenticated/`. Queries and mutations go in `src/lib/queries.ts`.

---

## Which Agent to Reach For

| Task | Agent |
|------|-------|
| Architectural decisions, new module design, event bus wiring | `/architect` |
| Any backend feature, use case, endpoint, migration | `/fastapi-coder` |
| Any frontend component, route, form, query | `/react-coder` |
| PR review before merging | `/code-reviewer` |
| Auth, token, or injection audit | `/security-reviewer` |

---

## Cross-Cutting Rules

- NEVER add comments unless asked
- NEVER create README/documentation files unless asked
- NEVER commit unless asked
- Run `ruff check` + `ruff format` + `mypy` before finishing backend work
- Run `npx tsc --noEmit` before finishing frontend work
- Preserve existing naming conventions (see `AGENTS.md`)
- **Always**: graphify first → read files second → write code third
