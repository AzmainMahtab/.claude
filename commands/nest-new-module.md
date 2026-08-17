---
description: Walk the full nest-kit new-bounded-context procedure end to end — boundary decision, inside-out write order, migration, gates, review.
argument-hint: <context-name> [what it is responsible for]
---

# New Bounded Context — `nest-kit`

Target context: **$ARGUMENTS**

Follow this in order. Each step's decisions are locked in by the one before it, which is why the order is inside-out rather than controller-first. Load the `nest-kit` skill for the code templates (`references/worked-module.md`) and the exact platform signatures (`references/platform-api.md`) rather than reproducing them here.

## Phase 0 — Orient

- [ ] Read `nest-kit/AGENTS.md`. Where it and a code comment disagree, it wins.
- [ ] Read `src/modules/owner/` end to end. Read `src/modules/car/` too if the new context needs value objects, batch writes, or another context's port; `src/modules/notification/` if it is a reaction with no HTTP surface.
- [ ] Confirm `make db-up` is running and `make migrate-up` is current, so gates can actually run.

## Phase 1 — Settle the boundary (before any file exists)

Answer all four in the response, briefly. If any answer is "not sure", stop and ask rather than guessing — each is expensive to change later.

- [ ] **Own context, or a feature of an existing one?** Does it have invariants nobody else enforces, and would it survive being deployed alone? If it needs a cross-schema join or foreign key, it is a feature of an existing context — say so and stop.
- [ ] **What is the aggregate, and what is its consistency boundary?** One aggregate is one transaction and one lock. If changing one row means loading an unbounded collection, the boundary is wrong.
- [ ] **What leaves the context?** The `index.ts` list: module, ports, aggregate, value objects, events.
- [ ] **What does it need from elsewhere — and can it be an event instead?** Take another context's port only for a synchronous precondition checked before a write. "When X happens, do Y" is a subscription.

## Phase 2 — Write it, inside out

Run `pnpm typecheck && pnpm check:arch` after step 2 and after every step from 6 onward. It is the fastest feedback in the repo, and unpicking a boundary violation across seven files at the end is miserable.

- [ ] 1. **Value objects** — `of()` normalises then validates, `fromPersistence()` skips validation. Normalisation lives here, not in the DTO.
- [ ] 2. **Aggregate + its spec** — private constructor, static factories, getters, `record`/`pullEvents`. Inject `now: Date` into every mutator. Decide per method whether re-running is a no-op or a throw — a redelivered event will call it. Write the spec now, before any framework exists.
- [ ] 3. **`errors.ts` + `events/index.ts`** — error factory functions with machine-readable codes; event names `<context>.<aggregate>.<past-tense-verb>`, payloads flat primitives.
- [ ] 4. **Port** — abstract class in `domain/ports/`, every method traceable to a use case that calls it, `null` for absence. A generic `findAll`/`update`/`delete` surface means it was written from the table and the context has no boundary.
- [ ] 5. **One command end to end** — command class (primitives), handler (build VOs outside the transaction, then load → guard → mutate → save → `publishAll(pullEvents())` inside it). Do not write the other commands yet.
- [ ] 6. **ORM entity + migration together** — `id BIGSERIAL` + `uuid UUID UNIQUE`, own schema, `TIMESTAMPTZ`, no index on `uuid`, no cross-schema FK, real `down()`. Index only what the port declares.
- [ ] 7. **Mapper + repository** — object-literal mapper using `fromPersistence`, repository extending `TransactionalRepository` resolving `this.manager()` per call, `save()` preserving the internal id.
- [ ] 8. **DTOs + controller** — `Dto.from(entity)`, `@ApiEnvelope`/`@ApiFailure`, no logic, no `try/catch`. Nothing privilege-bearing bindable on a public route.
- [ ] 9. **`<ctx>.module.ts` + `index.ts`**, then import in `app.module.ts` alongside the other contexts — which stay **below `HttpModule`**.
- [ ] 10. **Prove it** — `make migrate-up`, start the app, exercise the one command with curl. Fix wiring now; the remaining use cases are mechanical after this.
- [ ] 11. **The remaining commands and queries** — same shape.
- [ ] 12. **Subscriptions last** — `DurableEventHandler` or in-process `@EventsHandler`, never both. Provider in its own module; stable `consumerName`; idempotent `handle`.
- [ ] 13. **Permissions** — if a route uses `@RequirePermissions('<ctx>:action')`, add the name to `src/database/seeds/rbac.catalog.ts` and run `make seed`. A name no route enforces must not enter the catalogue.
- [ ] 14. **Tests** — unit specs beside the code with fakes extending the port; an e2e spec in `test/` calling `configureApp(app)` if the context has an HTTP surface.

## Phase 3 — Gates

```bash
cd nest-kit
pnpm lint
pnpm typecheck
pnpm check:arch
pnpm test
make migrate-up && make migrate-down && make migrate-up   # prove down() works
```

Or `make check` for the first four. If the context has an HTTP surface or a subscription, also:

```bash
make db-up && make migrate-up
pnpm test:e2e
```

## Phase 4 — Review

- [ ] Hand the diff to `nest-code-reviewer`.
- [ ] If the context touches tokens, sessions, guards, permissions, or public routes, also hand it to `nest-security-reviewer`.
- [ ] Report what was built, which gates passed, and anything deliberately left out.

## Do not

- Merge layers to save files. The layer count is the boundary.
- Throw a `@nestjs/common` HTTP exception from `domain/` or `application/`.
- Reach into another context past its `index.ts`, or inject its concrete adapter.
- Add a cross-schema foreign key or join.
- Register the ORM entity or the durable handler in a central list — both are discovered.
- Add comments, create README files, or commit unless asked.
