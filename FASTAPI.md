Stack and architecture for `mtns-academy-backend/`. Imported by `CLAUDE.md`.

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

Authoritative rules: `mtns-academy-backend/AGENTS.md`.

Use `/fastapi` (skill) for the step-by-step recipe, `/fastapi-coder` (agent) to implement.

Before finishing FastAPI work, run `ruff check` + `ruff format` + `mypy`.
