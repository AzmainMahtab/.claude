Stack, architecture, and non-negotiables for `go-kit/`. Imported by `CLAUDE.md`.

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

Authoritative rules: `go-kit/AGENTS.md`.

Use `/go-kit` (skill) for the step-by-step recipe, `/go-coder` (agent) to implement.

Before finishing go-kit work, run `make check` (gofmt + vet + golangci-lint + race tests).
