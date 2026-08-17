---
name: nest-kit
description: Use when implementing a new bounded context, use case, endpoint, adapter, event handler, or migration in nest-kit — the NestJS modular monolith (Clean Architecture / Ports & Adapters + DDD + CQRS, sliced vertically by bounded context). Covers the write order, the layer rules, and the quality gates.
---

# Nest Kit Module Skill

Use this skill when asked to implement a new bounded context, use case, endpoint, adapter, or migration in `nest-kit`.

`nest-kit` is a **modular monolith**: Clean Architecture (ports & adapters) + DDD + CQRS, sliced **vertically** by bounded context. Every context owns its full stack down to its own Postgres schema. Read `nest-kit/AGENTS.md` for the authoritative rules before writing anything — where it and a code comment disagree, it wins.

Two companion references live next to this file:

- `references/platform-api.md` — exact signatures of every shared and platform surface a context consumes. Read it instead of guessing an API.
- `references/worked-module.md` — one complete context, every file, in write order. Copy from it.

## Step 1 — Orient

```bash
cd nest-kit
cat AGENTS.md                        # authoritative rules, 15 numbered sections
ls src/modules/                      # auth, car, identity, notification, owner, rbac
```

Then read one analogous context end to end. Pick by shape:

| Read this | When your context is |
|---|---|
| `src/modules/owner/` | An ordinary aggregate with commands, queries, and one reaction — the simplest complete slice |
| `src/modules/car/` | Rich in value objects, money, batch writes, or needs another context's port |
| `src/modules/notification/` | A reaction only — no application layer, no presentation layer, no HTTP surface |
| `src/modules/rbac/` | Multi-aggregate, Redis-cached, exposes a port to `platform/` |

Do NOT invent patterns. Run `graphify query "<feature>"` only if `graphify-out/graph.json` exists — `nest-kit` is not currently in the workspace graph.

## Step 2 — Settle the Boundary Before Writing

Four questions, answered before a file exists. Each is expensive to change later.

1. **Is this its own context, or a feature of an existing one?** The test is transactional, not conceptual: does it have invariants nobody else enforces, and would it survive being deployed alone? If it needs a cross-schema join or a foreign key to work, it is a feature of an existing context.
2. **What is the aggregate, and what is its consistency boundary?** One aggregate is one transaction and one lock. `Role` holds its permission grants because they change together; it does not hold the users who have that role, because that set is unbounded. If you must load a collection to change one row, the boundary is wrong.
3. **What leaves the context?** Its ports, aggregate, value objects, and events — that is `index.ts`, and it is a contract.
4. **What does it need from elsewhere, and can it be an event instead?** Take another context's port only when you need a synchronous answer *before* you write. "When X happens, do Y" is a subscription, not a dependency.

## Step 3 — Value Objects First

Smallest thing with no dependencies, and it sets the vocabulary the rest of the context speaks. `of()` for untrusted input — normalise, **then** validate. `fromPersistence()` for trusted rows, skipping validation so a row predating a rule still loads.

```ts
import { AppError } from '../../../../shared/errors';

const PATTERN = /^[A-Z0-9-]{3,32}$/;

export class ThingCode {
  private constructor(readonly value: string) {}

  static of(raw: string): ThingCode {
    const normalised = raw.trim().toUpperCase().replace(/\s+/g, '-');

    if (normalised.length === 0) {
      throw AppError.validation('code', 'must not be empty');
    }

    if (!PATTERN.test(normalised)) {
      throw AppError.validation('code', 'must be 3 to 32 letters, digits or dashes');
    }

    return new ThingCode(normalised);
  }

  static fromPersistence(value: string): ThingCode {
    return new ThingCode(value);
  }

  equals(other: ThingCode): boolean {
    return this.value === other.value;
  }
}
```

Normalisation belongs here, never in the DTO: an HTTP request, an event handler, and a seeder all come through this door and must get the same answer.

## Step 4 — The Aggregate (zero framework imports)

`domain/` may import stdlib, `uuidv7`, and `src/shared/**`. Nothing else — no `@nestjs/*`, no `typeorm`, no `class-validator`.

Private constructor. A static factory per legitimate origin. Getters over public mutable fields. One method per state transition, asserting its own invariants. The aggregate **records** events; it never publishes them.

```ts
export class Thing {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly uuid: string,
    readonly code: ThingCode,
    private _name: string,
    private _status: ThingStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(input: { code: ThingCode; name: string; now: Date }): Thing {
    const thing = new Thing(
      uuidv7(),
      input.code,
      requireText(input.name, 'name', 128),
      ThingStatus.Draft,
      input.now,
      input.now,
    );

    thing.record(new ThingCreated(thing.uuid, thing.code.value));
    return thing;
  }

  static fromSnapshot(snapshot: ThingSnapshot): Thing { ... }

  get status(): ThingStatus { return this._status; }

  /** Idempotent: the usual caller is a redelivered event, and archiving twice must not emit twice. */
  archive(reason: string, now: Date): void {
    if (this._status === ThingStatus.Archived) {
      return;
    }

    this._status = ThingStatus.Archived;
    this._updatedAt = now;
    this.record(new ThingArchived(this.uuid, reason));
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}
```

Two things to get right the first time, because retrofitting them is miserable:

- **Inject `now: Date` into every mutator.** `new Date()` inside a method makes the aggregate untestable and leads to a mock clock library.
- **Decide per method whether re-running is a no-op or an error.** A `DurableEventHandler` will call it on redelivery. `archive()` returns early; a transfer-style method throws.

Status enums are const objects plus a type guard, so a mapper can validate a row:

```ts
export const ThingStatus = { Draft: 'DRAFT', Active: 'ACTIVE', Archived: 'ARCHIVED' } as const;
export type ThingStatus = (typeof ThingStatus)[keyof typeof ThingStatus];
export function isThingStatus(value: string): value is ThingStatus {
  return Object.values(ThingStatus).includes(value as ThingStatus);
}
```

## Step 5 — Errors and Events

`domain/errors.ts` — factory functions, not subclasses, so callers match on `code` and the code is greppable:

```ts
export const ThingNotFound = (): AppError => AppError.notFound('THING_NOT_FOUND', 'thing not found');

export const CodeAlreadyUsed = (): AppError =>
  AppError.conflict('CODE_ALREADY_USED', 'that code is already in use').withField(
    'code',
    'already in use',
  );
```

`domain/events/index.ts` — names are `<context>.<aggregate>.<past-tense-verb>`, payloads are flat primitives. Never a domain class or a value object instance: a consumer may be a separate service by then and only ever sees the wire shape.

```ts
export class ThingCreated extends DomainEvent {
  readonly name = 'catalog.thing.created';

  constructor(
    readonly thingUuid: string,
    readonly code: string,
  ) {
    super();
  }
}
```

`DomainEvent` supplies `version`, `idempotencyKey`, and `occurredAt`. Do not extend `@nestjs/cqrs`'s `AggregateRoot` — its `apply()`/`commit()` pattern drags the framework into `domain/`.

## Step 6 — The Port (write it from the use cases, not the table)

Abstract class, in the consuming context's `domain/ports/`. Every method must exist because a use case calls it. A generic `findAll`/`update`/`delete` surface is the tell that it was generated from the schema, and it leaves the context with no boundary.

```ts
export abstract class ThingRepository {
  abstract findByUuid(uuid: string): Promise<Thing | null>;

  abstract findByCode(code: ThingCode): Promise<Thing | null>;

  abstract list(params: PaginationParams): Promise<Page<Thing>>;

  abstract save(thing: Thing): Promise<void>;
}
```

"Not found" returns `null` — never throws, never a sentinel. The use case decides what absence means.

## Step 7 — Application Layer (CQRS)

Commands are plain classes with primitive fields. No decorators, no validation, no value objects.

```ts
export class CreateThingCommand {
  constructor(
    readonly code: string,
    readonly name: string,
  ) {}
}
```

The handler orchestrates ports and nothing else. Ordering is fixed: **build value objects → open the transaction → load → guard → mutate the aggregate → save → publish → return.**

```ts
@CommandHandler(CreateThingCommand)
export class CreateThingHandler implements ICommandHandler<CreateThingCommand, Thing> {
  constructor(
    private readonly things: ThingRepository,
    private readonly events: EventBus,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(command: CreateThingCommand): Promise<Thing> {
    const code = ThingCode.of(command.code);

    return this.uow.withTransaction(async () => {
      if (await this.things.findByCode(code)) {
        throw CodeAlreadyUsed();
      }

      const thing = Thing.create({ code, name: command.name, now: this.clock.now() });

      await this.things.save(thing);
      await this.events.publishAll(thing.pullEvents());

      return thing;
    });
  }
}
```

Value objects are built **outside** the transaction — a malformed code is a validation failure and there is no reason to open a transaction for it. Events are published **inside** it: `EventBus` routes them into `outbox.events` on the same connection, so they commit or roll back with the data that produced them.

Queries colocate the query class and its handler in `application/queries/<ctx>.queries.ts`:

```ts
@QueryHandler(GetThingQuery)
export class GetThingHandler implements IQueryHandler<GetThingQuery, Thing> {
  constructor(private readonly things: ThingRepository) {}

  async execute(query: GetThingQuery): Promise<Thing> {
    const thing = await this.things.findByUuid(query.uuid);

    if (!thing) {
      throw ThingNotFound();
    }

    return thing;
  }
}
```

**Write one command end to end — through Step 11 — before writing the rest.** The first one flushes out every wiring mistake; the remaining ones are mechanical.

## Step 8 — Infrastructure: ORM Entity and Migration Together

They are the same decision expressed twice, so writing them apart is how they drift. The `BIGSERIAL` internal id exists here and nowhere else.

```ts
@Entity({ schema: 'catalog', name: 'things' })
export class ThingOrmEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', unique: true })
  uuid!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: ThingStatus;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
```

It registers **nowhere** — `platform/database/data-source.ts` discovers it by the `modules/**/*.orm-entity.{ts,js}` glob. There is no `TypeOrmModule.forFeature`.

```bash
make migrate-create NAME=CreateCatalogThings
make migrate-up
```

Hand-written raw SQL, one schema per context, real `down()`:

```ts
export class CreateCatalogThings1785940000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS catalog');

    await queryRunner.query(`
      CREATE TABLE catalog.things (
          id          BIGSERIAL PRIMARY KEY,
          uuid        UUID NOT NULL UNIQUE,
          code        VARCHAR(32) NOT NULL UNIQUE,
          name        VARCHAR(128) NOT NULL,
          status      VARCHAR(32) NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX things_active_idx ON catalog.things (created_at DESC) WHERE status = 'ACTIVE'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE catalog.things');
    await queryRunner.query('DROP SCHEMA IF EXISTS catalog');
  }
}
```

- No explicit index on `uuid` — the `UNIQUE` constraint already created a btree, and a second is pure write and disk overhead.
- `TIMESTAMPTZ`, never `TIMESTAMP`.
- Index the queries the port actually declares. Nothing speculative.
- **No cross-schema foreign key.** A reference to another context is a plain `uuid` column; referential integrity is checked in the use case against that context's port. A cross-schema FK would have to be dropped before either context could be extracted.
- Money is `NUMERIC(12, 2)`, never `double precision`.

## Step 9 — Mapper and Repository

The mapper is an exported object literal. Rehydrate value objects with `fromPersistence`, never `of`, and fall back on an unknown enum string rather than crashing.

```ts
export const ThingMapper = {
  toDomain(row: ThingOrmEntity): Thing {
    return Thing.fromSnapshot({
      uuid: row.uuid,
      code: ThingCode.fromPersistence(row.code),
      name: row.name,
      status: isThingStatus(row.status) ? row.status : ThingStatus.Archived,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toOrm(thing: Thing, internalId?: string): ThingOrmEntity {
    const row = new ThingOrmEntity();

    if (internalId !== undefined) {
      row.id = internalId;
    }

    row.uuid = thing.uuid;
    row.code = thing.code.value;
    row.name = thing.name;
    row.status = thing.status;
    row.createdAt = thing.createdAt;
    row.updatedAt = thing.updatedAt;

    return row;
  },
};
```

The repository extends `TransactionalRepository` and resolves the manager **per call**, so a use case can wrap it in a transaction without the repository knowing.

```ts
@Injectable()
export class TypeOrmThingRepository extends TransactionalRepository implements ThingRepository {
  constructor(dataSource: DataSource, context: TransactionContext) {
    super(dataSource, context);
  }

  private get repository() {
    return this.manager().getRepository(ThingOrmEntity);
  }

  async findByUuid(uuid: string): Promise<Thing | null> {
    const row = await this.repository.findOne({ where: { uuid } });
    return row ? ThingMapper.toDomain(row) : null;
  }

  async list(params: PaginationParams): Promise<Page<Thing>> {
    const [rows, total] = await this.repository.findAndCount({
      order: { id: 'DESC' },
      skip: params.offset,
      take: params.limit,
    });

    return Page.of(rows.map((row) => ThingMapper.toDomain(row)), total, params);
  }

  async save(thing: Thing): Promise<void> {
    const existing = await this.repository.findOne({
      where: { uuid: thing.uuid },
      select: { id: true },
    });

    await this.repository.save(ThingMapper.toOrm(thing, existing?.id));
  }
}
```

Never capture an `EntityManager` in a field. Money and decimals stay `string` end to end — TypeORM `numeric` already returns one, and `parseFloat` is the bug.

## Step 10 — Presentation

DTOs are `class-validator` classes in `presentation/http/dto/`. A DTO is a boundary type and never reaches `application/` or `domain/`. The response DTO carries a `static from(entity)`.

```ts
export class CreateThingDto {
  @ApiProperty({ example: 'WIDGET-1' })
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Widget' })
  @IsString()
  @MaxLength(128)
  name!: string;
}

export class ThingResponseDto {
  @ApiProperty() uuid!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Object.values(ThingStatus) }) status!: ThingStatus;
  @ApiProperty() createdAt!: string;

  static from(thing: Thing): ThingResponseDto {
    return {
      uuid: thing.uuid,
      code: thing.code.value,
      name: thing.name,
      status: thing.status,
      createdAt: thing.createdAt.toISOString(),
    };
  }
}
```

The controller decodes, builds, executes, maps. No business logic, no repository access, no `try/catch`.

```ts
@ApiTags('Things')
@ApiBearerAuth()
@ApiAuthFailures()
@Controller('things')
export class ThingsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Post()
  @RequirePermissions('catalog:admin')
  @ApiOperation({ summary: 'Create a thing' })
  @ApiEnvelope(ThingResponseDto, { status: 201, description: 'Created' })
  @ApiValidationFailure()
  @ApiFailure(409, 'CODE_ALREADY_USED', 'Codes are compared after normalisation')
  async create(@Body() dto: CreateThingDto): Promise<ThingResponseDto> {
    const thing = await this.commands.execute<CreateThingCommand, Thing>(
      new CreateThingCommand(dto.code, dto.name),
    );
    return ThingResponseDto.from(thing);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get a thing' })
  @ApiEnvelope(ThingResponseDto, { status: 200 })
  @ApiFailure(404, 'THING_NOT_FOUND')
  async get(@Param('uuid', ParseUUIDPipe) uuid: string): Promise<ThingResponseDto> {
    const thing = await this.queries.execute<GetThingQuery, Thing>(new GetThingQuery(uuid));
    return ThingResponseDto.from(thing);
  }
}
```

Use `@ApiEnvelope` / `@ApiFailure`, never a bare `@ApiResponse({ type })`: the controller returns the inner DTO but the interceptor sends `{ success, data }`, so a bare type documents a shape that is never sent. `@ApiBearerAuth()` goes per method on a controller mixing public and protected routes — at class level it would claim a `@Public()` route needs a token.

A new permission name must be added to `src/database/seeds/rbac.catalog.ts`, and only if a real route enforces it.

## Step 11 — Module Facade, Public Surface, Composition Root

`<ctx>.module.ts` is a facade — it binds ports to adapters and declares what leaves. No logic.

```ts
@Module({
  controllers: [ThingsController],
  providers: [
    { provide: ThingRepository, useClass: TypeOrmThingRepository },
    CreateThingHandler,
    ArchiveThingHandler,
    GetThingHandler,
    ListThingsHandler,
    ArchiveThingsOnOwnerDeactivated,
  ],
  exports: [ThingRepository],
})
export class CatalogModule {}
```

If it needs another context, import that context's module and inject the **port** it exports — never a concrete service:

```ts
imports: [OwnerModule],   // For owner's OwnerRepository port only.
```

`index.ts` is the only public surface:

```ts
export { CatalogModule } from './catalog.module';
export { ThingRepository } from './domain/ports/thing-repository.port';
export { Thing, ThingStatus } from './domain/thing';
export { ThingCode } from './domain/value-objects/thing-code';
export { ThingArchived, ThingCreated } from './domain/events';
```

Then add it to `src/app.module.ts` alongside the other contexts, which stay **below `HttpModule`** — Nest runs global guards in registration order, and the rate limiter must see a request before `JwtAuthGuard` spends a signature verification on it.

## Step 12 — Subscriptions (last)

Write these once the aggregate's idempotent methods exist to call. Pick one mode; never both.

| | `@EventsHandler` | `DurableEventHandler` |
|---|---|---|
| Delivery | in-process, right after commit | JetStream, at-least-once |
| Survives a crash | no | yes |
| Use for | immediate work you can afford to lose | anything durable, slow, or cross-context |

```ts
@Injectable()
export class ArchiveThingsOnOwnerDeactivated extends DurableEventHandler {
  readonly consumerName = 'catalog_archive_on_owner_deactivated';
  readonly subjects = ['owner.owner.deactivated'];

  constructor(
    private readonly things: ThingRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) {
    super();
  }

  async handle(event: EventMessage): Promise<void> {
    const { ownerUuid, reason } = event.payload as { ownerUuid: string; reason: string };
    ...
  }
}
```

`consumerName` is stable — changing it replays from the start. It is discovered automatically by `DurableConsumerService`, so there is no central registry, but it **must** be a provider in its own context's module. `handle` runs in a transaction that also writes the `messaging.processed_events` marker, so a failure genuinely retries. It sees `EventMessage` — the wire shape — never a domain class from the producing context.

## Step 13 — Tests

Unit specs sit next to the code. A use case is a plain class: construct it directly with fakes extending the abstract port.

```ts
class FakeThingRepository extends ThingRepository {
  readonly saved: Thing[] = [];
  async findByUuid(uuid: string) { return this.saved.find((t) => t.uuid === uuid) ?? null; }
  async save(thing: Thing) { this.saved.push(thing); }
  ...
}

class PassThroughUnitOfWork extends UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T> { return work(); }
}

class FixedClock extends Clock {
  now() { return new Date('2026-01-01T00:00:00.000Z'); }
}

it('rejects a duplicate code', async () => {
  const handler = new CreateThingHandler(repo, new RecordingEventBus(), new PassThroughUnitOfWork(), new FixedClock());
  await expect(handler.execute(new CreateThingCommand('WIDGET-1', 'Widget'))).rejects.toMatchObject({
    code: 'CODE_ALREADY_USED',
  });
});
```

Never mock TypeORM. Never `Test.createTestingModule` for a use case — that is for controllers and module wiring only. Assert on `err.code`, never on message text. One test per behaviour.

E2E specs live only in `test/*.e2e-spec.ts`, must call `configureApp(app)` so the global pipe, filter, interceptor, and guard chain match production, and need real infrastructure:

```bash
make db-up
make migrate-up
pnpm test:e2e
```

They share one database, so they run `--runInBand`, truncate their tables in `beforeEach`, and purge the JetStream stream if they touch it. Environment overrides go in `test/setup-e2e.ts`, never at the top of a spec — `ConfigModule.forRoot()` reads the environment when `app.module.ts` is first imported, and imports are evaluated before any statement in the importing file.

## Quality Gates (run before finishing)

```bash
cd nest-kit
pnpm lint
pnpm typecheck
pnpm check:arch      # hand-written gate in scripts/check-arch.mjs
pnpm test
```

Or in one shot: `make check`

Run `pnpm check:arch` early and often — it is the fastest feedback in the repo and catches the one class of mistake you cannot see by reading. Waiting until the end means unpicking imports across seven files. Its rules and verbatim messages are in `references/platform-api.md`.

## Hard Rules

- `domain/` and `src/shared/` import zero framework. `domain/` and `application/` additionally import nothing from `src/platform/`.
- Ports are declared by the consumer inside its own context, as an `abstract class` — never an `interface`, never a shared `ports/` module.
- One error model: throw `AppError`, mapped by `AppErrorFilter`. **Never** a `@nestjs/common` HTTP exception from `domain/` or `application/` — that is what makes a context unextractable.
- The internal `BIGSERIAL` id never leaves `infrastructure/persistence/`. New uuids are UUIDv7.
- Publish events inside the transaction that wrote the data, through the one `publish`. Call sites never choose a durability mode.
- A reaction is an `@EventsHandler` **or** a `DurableEventHandler`, never both.
- Cross-context access is another context's `index.ts` port or its published events. Never its internals, never a concrete adapter, never a cross-schema foreign key or join.
- A DTO never passes the controller. A command carries primitives.
- Money and decimals are decimal strings end to end. No `parseFloat`, no `Number()` on a `numeric`.
- Time comes from the injected `Clock`. `process.env` is read only in `platform/config/`.
- A permission name that no route enforces grants nothing and must not enter the catalogue.
- NEVER add comments unless asked. NEVER create README files unless asked. NEVER commit unless asked.
