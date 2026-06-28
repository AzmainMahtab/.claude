# Fullstack Feature Skill

Use this skill when asked to build a complete feature end-to-end — backend module + API endpoint + frontend route/form. Combines the FastAPI and React skills in the right order.

## Order of Operations

Always build backend first, then frontend. The backend contract (response schema, endpoint path) drives the frontend types.

```
1. Graph + domain design  →  2. Backend implementation  →  3. API contract  →  4. Frontend
```

---

## Phase 1 — Graph & Domain Design

```bash
graphify query "<feature name>"    # find existing related nodes
graphify path "UserX" "ThingY"     # check if a path already exists
cat graphify-out/GRAPH_REPORT.md   # check for relevant communities
```

Decide:
- What module does this belong to? (new or existing)
- What domain events does it publish?
- What cross-module side effects happen via the event bus?
- What API shape does the frontend need?

---

## Phase 2 — Backend

Follow the FastAPI skill (`/.claude/skills/fastapi/SKILL.md`) in order:

1. **Domain layer** — entities, value objects, interfaces, events, exceptions (no framework imports)
2. **CQRS** — `*Command`, `*Query`, `*Result` frozen dataclasses
3. **Use case** — validate → business logic → persist → publish event → return result
4. **API layer** — schemas, router, DI dependencies
5. **Infrastructure** — SQLAlchemy model, mapper, repository
6. **Wire in main.py** — include router, register event handlers in lifespan
7. **Tests** — in-memory repository, failure paths covered
8. **Migration** — `alembic revision --autogenerate` + `alembic upgrade head`

Quality gate before moving to frontend:
```bash
uv run ruff check app/ && uv run ruff format app/
uv run mypy app/
uv run pytest
```

---

## Phase 3 — Define the API Contract

Write the exact API shape the frontend will consume. Confirm:

| Item | Value |
|------|-------|
| Method + path | e.g. `POST /api/v1/things` |
| Request body | fields, types, validation rules |
| Response shape | `{ data: ThingResponse }` (SuccessEnvelope) |
| Error codes | e.g. `THING_NOT_FOUND` → 404 |
| Auth required? | yes/no, role if relevant |

---

## Phase 4 — Frontend

Follow the React skill (`/.claude/skills/react/SKILL.md`) in order:

1. **Type** — add `ThingResponse` / `CreateThingRequest` to `src/types/api.ts`
2. **Query/mutation** — add to `src/lib/queries.ts` (unwrap `{ data: T }` envelope)
3. **Route** — create file in `src/routes/` (auth-gated if needed), run `npx @tanstack/router-plugin generate`
4. **Form** — Zod schema + react-hook-form, shadcn/ui inputs, mutation on submit
5. **Loading/error** — Suspense boundary, toast feedback via sonner

Quality gate:
```bash
npx tsc --noEmit
npx eslint src/
```

---

## Checklist for Full-Stack Features

### Backend
- [ ] Domain layer has zero framework imports
- [ ] Use case follows validate → persist → publish → return pattern
- [ ] Event published only after successful persistence
- [ ] New router included in `app/main.py`
- [ ] Event handlers registered in lifespan
- [ ] Tests cover happy path + at least 2 failure cases
- [ ] Alembic migration generated and applied

### Frontend
- [ ] API types in `src/types/api.ts`
- [ ] Query/mutation in `src/lib/queries.ts` (not inline in components)
- [ ] Route regenerated with `@tanstack/router-plugin`
- [ ] Form uses Zod + react-hook-form
- [ ] Success/error feedback via `sonner` toast
- [ ] `tsc --noEmit` passes

### Cross-Cutting
- [ ] No comments added unless explaining a non-obvious WHY
- [ ] No new dependencies added without checking existing libraries cover the need
- [ ] No README or docs files created
- [ ] Nothing committed unless asked
