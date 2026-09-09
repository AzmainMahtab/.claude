Stack, architecture, and non-negotiables for `nest-kit/`. Imported by `CLAUDE.md`.

| Concern | Tool |
|---------|------|
| Language | Node 24, TypeScript 5.7 (`nodenext`, `strict`), pnpm |
| Framework | NestJS 11 + `@nestjs/cqrs` (CommandBus / QueryBus) |
| DB | TypeORM + `pg` + PostgreSQL — one schema per bounded context |
| Cache / blacklist / rate limit | Redis (`ioredis`) |
| Passwords | Argon2id (`@node-rs/argon2`) |
| Tokens | **ES256 (ECDSA P-256) keypair** via `jose` — never HS256 |
| Events | Outbox → NATS JetStream (`@nats-io/jetstream`), plus the in-process bus |
| Migrations | TypeORM, hand-written SQL, `synchronize: false` everywhere |
| Observability | `prom-client` + structured JSON logs + correlation id |
| Quality | eslint + prettier + tsc + `check:arch` + jest |

Architecture: **Modular Monolith + Clean Architecture (Ports & Adapters) + DDD + CQRS**, sliced **vertically** by bounded context. Dependency rule: `presentation/ → application/ → domain/`; `infrastructure/` implements ports declared in `domain/`. `domain/` and `src/shared/` have zero framework imports; `infrastructure/` and `presentation/` may import `src/platform/`, `application/` and `domain/` may not.

Non-negotiables:
- Ports are declared by the consumer inside its own context, as an `abstract class` — both the contract and the DI token. No central `ports/` module, never an `interface`.
- One error model: throw `AppError`, mapped by the global `AppErrorFilter`. **Never** a `@nestjs/common` HTTP exception from `domain/` or `application/`.
- Domain identity is the public UUIDv7; the `BIGSERIAL` internal id never leaves `infrastructure/persistence/`.
- Access vs refresh tokens are distinguished by a `typ` claim, checked on every parse.
- Events publish **inside** the transaction that wrote the data — the outbox row is what makes that safe. There is one `publish`; call sites never choose a durability mode.
- A reaction is an in-process `@EventsHandler` **or** a `DurableEventHandler`, never both.
- Cross-context access is the other context's `index.ts` port or its published events — never its internals, never a cross-schema foreign key.

Authoritative rules: `nest-kit/AGENTS.md` (15 numbered sections; it wins over any code comment).

**`nest-kit/` is not covered by `graphify-out/`** — the graph does not include it. Start from `AGENTS.md` and an analogous context (`src/modules/owner/` is the simplest complete slice) instead of a graph query.

Use `/nest-kit` (skill) for the step-by-step recipe, `/nest-coder` (agent) to implement, `/nest-new-module` (command) for a whole new bounded context. Review with `/nest-code-reviewer`, and `/nest-security-reviewer` for anything touching tokens, guards, permissions, or public routes.

Before finishing nest-kit work, run `make check` (lint + typecheck + `check:arch` + unit tests). `pnpm test:e2e` is separate and needs `make db-up && make migrate-up`.
