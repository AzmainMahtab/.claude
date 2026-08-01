# MTNS Academy — Claude Workflow

## Project Layout

```
repo/
├── mtns-academy-backend/   # FastAPI modular monolith (Python 3.14+, uv)
├── mtns-academy-frontend/  # React 19 SPA (Vite, TanStack Router/Query, shadcn)
├── go-kit/                 # Go modular monolith starter kit (Hexagonal + DDD + CQRS)
└── graphify-out/           # Knowledge graph — check this first on any task
```

Authoritative architecture rules live next to the code. Always read the relevant one before touching it:

| Codebase | Rules file |
|----------|------------|
| `mtns-academy-backend/` | `mtns-academy-backend/AGENTS.md` |
| `go-kit/` | `go-kit/AGENTS.md` |

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

## Go Kit Stack (`go-kit/`)

| Concern | Tool |
|---------|------|
| Language | Go 1.26+ |
| Router | chi v5 + net/http |
| DB | sqlx + pgx/v5 + PostgreSQL |
| Cache / blacklist / rate limit | Redis (`go-redis/v9`) |
| Passwords | Argon2id (`golang.org/x/crypto/argon2`) |
| Tokens | **ES256 (ECDSA P-256) keypair** via `golang-jwt/v5` — never HS256 |
| Events | `InMemoryEventBus` (`internal/shared/eventbus/`) |
| Audit | NATS JetStream → durable worker → partitioned `audit_log` |
| Migrations | Goose (SQL) |
| Quality | gofmt + go vet + golangci-lint + `go test -race` |

Architecture: **Modular Monolith + Hexagonal (Ports & Adapters) + DDD + CQRS**, sliced **vertically** by bounded context. Dependency rule: `presentation/ → application/ → domain/`; `infrastructure/` implements ports declared in `domain/`. `domain/` has zero framework imports.

Non-negotiables:
- Ports are declared by the consumer inside its own context — no central `ports/` package.
- One error model: return `*apperrors.AppError`, map with `responses.HandleError`. No per-module `mapError`.
- Domain identity is the public `uuid.UUID`; the `BIGSERIAL` internal id never leaves `infrastructure/persistence/`.
- Access vs refresh tokens are distinguished by a `typ` claim, checked on every parse.

Use `/go-kit` (skill) for the step-by-step recipe, `/go-coder` (agent) to implement.

---

## Which Agent to Reach For

| Task | Agent |
|------|-------|
| Architectural decisions, new module design, event bus wiring | `/architect` |
| Any FastAPI feature, use case, endpoint, migration | `/fastapi-coder` |
| Any Go / go-kit context, use case, endpoint, adapter, migration | `/go-coder` |
| Any frontend component, route, form, query | `/react-coder` |
| PR review before merging | `/code-reviewer` |
| Auth, token, or injection audit | `/security-reviewer` |

---

## Cross-Cutting Rules

- NEVER add comments unless asked
- NEVER create README/documentation files unless asked
- NEVER commit unless asked
- Run `ruff check` + `ruff format` + `mypy` before finishing FastAPI work
- Run `make check` (gofmt + vet + golangci-lint + race tests) before finishing go-kit work
- Run `npx tsc --noEmit` before finishing frontend work
- Preserve existing naming conventions (see the relevant `AGENTS.md`)
- **Always**: graphify first → read files second → write code third
