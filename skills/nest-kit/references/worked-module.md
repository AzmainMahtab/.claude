# nest-kit — A Complete Worked Context

One bounded context, every file, in the order you write them. Context is `catalog`, aggregate is `Thing`. Copy from here and rename; the relative import depths are correct as written for `src/modules/<ctx>/...`.

The write order is inside-out on purpose. Going outside-in (controller first) means inventing the domain to fit a DTO you already wrote.

---

## 1. `domain/value-objects/thing-code.ts`

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

  toString(): string {
    return this.value;
  }
}
```

---

## 2. `domain/thing.ts`

```ts
import { uuidv7 } from 'uuidv7';

import { DomainEvent } from '../../../shared/domain';
import { AppError } from '../../../shared/errors';
import { ThingArchived, ThingCreated, ThingRenamed } from './events';
import { ThingAlreadyActive, ThingArchivedError } from './errors';
import { ThingCode } from './value-objects/thing-code';

export const ThingStatus = {
  Draft: 'DRAFT',
  Active: 'ACTIVE',
  Archived: 'ARCHIVED',
} as const;

export type ThingStatus = (typeof ThingStatus)[keyof typeof ThingStatus];

export function isThingStatus(value: string): value is ThingStatus {
  return Object.values(ThingStatus).includes(value as ThingStatus);
}

export interface ThingSnapshot {
  uuid: string;
  ownerUuid: string;
  code: ThingCode;
  name: string;
  status: ThingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Thing {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly uuid: string,
    readonly ownerUuid: string,
    readonly code: ThingCode,
    private _name: string,
    private _status: ThingStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(input: {
    ownerUuid: string;
    code: ThingCode;
    name: string;
    now: Date;
  }): Thing {
    const thing = new Thing(
      uuidv7(),
      input.ownerUuid,
      input.code,
      requireText(input.name, 'name', 128),
      ThingStatus.Draft,
      input.now,
      input.now,
    );

    thing.record(new ThingCreated(thing.uuid, thing.ownerUuid, thing.code.value));
    return thing;
  }

  static fromSnapshot(snapshot: ThingSnapshot): Thing {
    return new Thing(
      snapshot.uuid,
      snapshot.ownerUuid,
      snapshot.code,
      snapshot.name,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this._name;
  }

  get status(): ThingStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isArchived(): boolean {
    return this._status === ThingStatus.Archived;
  }

  rename(name: string, now: Date): void {
    this.assertNotArchived();

    const next = requireText(name, 'name', 128);

    if (next === this._name) {
      return;
    }

    this._name = next;
    this._updatedAt = now;
    this.record(new ThingRenamed(this.uuid, next));
  }

  activate(now: Date): void {
    this.assertNotArchived();

    if (this._status === ThingStatus.Active) {
      throw ThingAlreadyActive();
    }

    this._status = ThingStatus.Active;
    this._updatedAt = now;
  }

  /**
   * Idempotent: the usual caller is a redelivered `owner.owner.deactivated`,
   * and archiving twice must not emit twice.
   */
  archive(reason: string, now: Date): void {
    if (this.isArchived) {
      return;
    }

    this._status = ThingStatus.Archived;
    this._updatedAt = now;
    this.record(new ThingArchived(this.uuid, reason));
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private assertNotArchived(): void {
    if (this.isArchived) {
      throw ThingArchivedError();
    }
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}

function requireText(value: string, field: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');

  if (trimmed.length === 0) {
    throw AppError.validation(field, 'must not be empty');
  }

  if (trimmed.length > max) {
    throw AppError.validation(field, `must be at most ${max} characters`);
  }

  return trimmed;
}
```

Note what is deliberate: `rename` on an unchanged name is a silent no-op (nothing happened, so nothing is recorded); `activate` on an already-active thing **throws** (the caller was wrong); `archive` on an archived thing is a no-op (a redelivered event is not a caller error).

---

## 3. `domain/thing.spec.ts`

Write this before any framework exists. It is the cheapest point to discover the model is wrong.

```ts
import { AppError } from '../../../shared/errors';
import { Thing, ThingStatus } from './thing';
import { ThingCode } from './value-objects/thing-code';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-02-01T00:00:00.000Z');

const aThing = (overrides: Partial<Parameters<typeof Thing.create>[0]> = {}) =>
  Thing.create({
    ownerUuid: 'owner-1',
    code: ThingCode.of('WIDGET-1'),
    name: 'Widget',
    now: NOW,
    ...overrides,
  });

describe('Thing', () => {
  it('creates as a draft and records the event', () => {
    const thing = aThing();

    expect(thing.status).toBe(ThingStatus.Draft);
    expect(thing.pullEvents().map((e) => e.name)).toEqual(['catalog.thing.created']);
  });

  it('trims and collapses whitespace in the name', () => {
    expect(aThing({ name: '  Big   Widget ' }).name).toBe('Big Widget');
  });

  it('rejects an empty name', () => {
    expect(() => aThing({ name: '   ' })).toThrow(AppError);
  });

  it('records nothing when renamed to the same name', () => {
    const thing = aThing();
    thing.pullEvents();

    thing.rename('Widget', LATER);

    expect(thing.pullEvents()).toEqual([]);
  });

  it('archives idempotently', () => {
    const thing = aThing();
    thing.pullEvents();

    thing.archive('owner deactivated', LATER);
    thing.archive('owner deactivated', LATER);

    expect(thing.status).toBe(ThingStatus.Archived);
    expect(thing.pullEvents().map((e) => e.name)).toEqual(['catalog.thing.archived']);
  });

  it('refuses to rename an archived thing', () => {
    const thing = aThing();
    thing.archive('done', LATER);

    const err = capture(() => thing.rename('New', LATER));

    expect(AppError.is(err, 'THING_ARCHIVED')).toBe(true);
  });
});

function capture(work: () => void): unknown {
  try {
    work();
  } catch (err) {
    return err;
  }

  throw new Error('expected a throw');
}
```

Assert on the `code` via `AppError.is`, never on message text. For an async use case, `await expect(...).rejects.toMatchObject({ code: 'X' })` does the same job.

---

## 4. `domain/errors.ts`

```ts
import { AppError } from '../../../shared/errors';

export const ThingNotFound = (): AppError => AppError.notFound('THING_NOT_FOUND', 'thing not found');

export const CodeAlreadyUsed = (): AppError =>
  AppError.conflict('CODE_ALREADY_USED', 'that code is already in use').withField(
    'code',
    'already in use',
  );

export const ThingArchivedError = (): AppError =>
  AppError.conflict('THING_ARCHIVED', 'an archived thing cannot be modified');

export const ThingAlreadyActive = (): AppError =>
  AppError.invalid('THING_ALREADY_ACTIVE', 'the thing is already active');

export const OwnerNotAcceptingThings = (): AppError =>
  AppError.invalid('OWNER_NOT_ACCEPTING_THINGS', 'owner does not exist or is inactive').withField(
    'ownerUuid',
    'must be an active owner',
  );
```

---

## 5. `domain/events/index.ts`

```ts
import { DomainEvent } from '../../../../shared/domain';

export class ThingCreated extends DomainEvent {
  readonly name = 'catalog.thing.created';

  constructor(
    readonly thingUuid: string,
    readonly ownerUuid: string,
    readonly code: string,
  ) {
    super();
  }
}

export class ThingRenamed extends DomainEvent {
  readonly name = 'catalog.thing.renamed';

  constructor(
    readonly thingUuid: string,
    readonly name_: string,
  ) {
    super();
  }
}

export class ThingArchived extends DomainEvent {
  readonly name = 'catalog.thing.archived';

  constructor(
    readonly thingUuid: string,
    readonly reason: string,
  ) {
    super();
  }
}
```

---

## 6. `domain/ports/thing-repository.port.ts`

Every method exists because a use case below calls it. `findActiveByOwner` and `saveAll` are here only because the archive reaction needs exactly those.

```ts
import { Page, PaginationParams } from '../../../../shared/pagination';
import { Thing } from '../thing';
import { ThingCode } from '../value-objects/thing-code';

export abstract class ThingRepository {
  abstract findByUuid(uuid: string): Promise<Thing | null>;

  abstract findByCode(code: ThingCode): Promise<Thing | null>;

  abstract list(params: PaginationParams, ownerUuid?: string): Promise<Page<Thing>>;

  /** Every non-archived thing for an owner — the deactivation reaction walks these. */
  abstract findActiveByOwner(ownerUuid: string): Promise<Thing[]>;

  abstract save(thing: Thing): Promise<void>;

  abstract saveAll(things: readonly Thing[]): Promise<void>;
}
```

---

## 7. `application/commands/catalog.commands.ts`

```ts
export class CreateThingCommand {
  constructor(
    readonly ownerUuid: string,
    readonly code: string,
    readonly name: string,
  ) {}
}

export class RenameThingCommand {
  constructor(
    readonly uuid: string,
    readonly name: string,
  ) {}
}

export class ArchiveThingCommand {
  constructor(
    readonly uuid: string,
    readonly reason: string,
  ) {}
}
```

---

## 8. `application/commands/catalog.handlers.ts`

```ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

import { OwnerRepository } from '../../../owner';
import { Clock, EventBus, UnitOfWork } from '../../../../shared/application';
import { Thing } from '../../domain/thing';
import { CodeAlreadyUsed, OwnerNotAcceptingThings, ThingNotFound } from '../../domain/errors';
import { ThingRepository } from '../../domain/ports/thing-repository.port';
import { ThingCode } from '../../domain/value-objects/thing-code';
import { ArchiveThingCommand, CreateThingCommand, RenameThingCommand } from './catalog.commands';

@CommandHandler(CreateThingCommand)
export class CreateThingHandler implements ICommandHandler<CreateThingCommand, Thing> {
  constructor(
    private readonly things: ThingRepository,
    // The owner context's port, from its public index.
    private readonly owners: OwnerRepository,
    private readonly events: EventBus,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(command: CreateThingCommand): Promise<Thing> {
    // Built before the transaction: a malformed code is a validation failure,
    // and there is no reason to open a transaction for it.
    const code = ThingCode.of(command.code);

    return this.uow.withTransaction(async () => {
      const owner = await this.owners.findByUuid(command.ownerUuid);

      if (!owner || !owner.isActive) {
        throw OwnerNotAcceptingThings();
      }

      if (await this.things.findByCode(code)) {
        throw CodeAlreadyUsed();
      }

      const thing = Thing.create({
        ownerUuid: command.ownerUuid,
        code,
        name: command.name,
        now: this.clock.now(),
      });

      await this.things.save(thing);
      await this.events.publishAll(thing.pullEvents());

      return thing;
    });
  }
}

@CommandHandler(RenameThingCommand)
export class RenameThingHandler implements ICommandHandler<RenameThingCommand, Thing> {
  constructor(
    private readonly things: ThingRepository,
    private readonly events: EventBus,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(command: RenameThingCommand): Promise<Thing> {
    return this.uow.withTransaction(async () => {
      const thing = await this.things.findByUuid(command.uuid);

      if (!thing) {
        throw ThingNotFound();
      }

      thing.rename(command.name, this.clock.now());
      await this.things.save(thing);
      await this.events.publishAll(thing.pullEvents());

      return thing;
    });
  }
}

@CommandHandler(ArchiveThingCommand)
export class ArchiveThingHandler implements ICommandHandler<ArchiveThingCommand, Thing> {
  constructor(
    private readonly things: ThingRepository,
    private readonly events: EventBus,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(command: ArchiveThingCommand): Promise<Thing> {
    return this.uow.withTransaction(async () => {
      const thing = await this.things.findByUuid(command.uuid);

      if (!thing) {
        throw ThingNotFound();
      }

      thing.archive(command.reason, this.clock.now());
      await this.things.save(thing);
      await this.events.publishAll(thing.pullEvents());

      return thing;
    });
  }
}
```

---

## 9. `application/commands/create-thing.handler.spec.ts`

A use case is a plain class — constructed directly, no testing module.

```ts
import { Clock, EventBus, UnitOfWork } from '../../../../shared/application';
import { DomainEvent } from '../../../../shared/domain';
import { OwnerRepository } from '../../../owner';
import { Thing } from '../../domain/thing';
import { ThingRepository } from '../../domain/ports/thing-repository.port';
import { ThingCode } from '../../domain/value-objects/thing-code';
import { CreateThingCommand } from './catalog.commands';
import { CreateThingHandler } from './catalog.handlers';

class FakeThingRepository extends ThingRepository {
  readonly saved: Thing[] = [];

  async findByUuid(uuid: string) {
    return this.saved.find((t) => t.uuid === uuid) ?? null;
  }

  async findByCode(code: ThingCode) {
    return this.saved.find((t) => t.code.equals(code)) ?? null;
  }

  async list() {
    throw new Error('not used');
  }

  async findActiveByOwner() {
    return [];
  }

  async save(thing: Thing) {
    this.saved.push(thing);
  }

  async saveAll(things: readonly Thing[]) {
    this.saved.push(...things);
  }
}

class RecordingEventBus extends EventBus {
  readonly published: DomainEvent[] = [];
  async publish(event: DomainEvent) { this.published.push(event); }
  async publishAll(events: readonly DomainEvent[]) { this.published.push(...events); }
}

class PassThroughUnitOfWork extends UnitOfWork {
  withTransaction<T>(work: () => Promise<T>): Promise<T> { return work(); }
}

class FixedClock extends Clock {
  now() { return new Date('2026-01-01T00:00:00.000Z'); }
}

const activeOwner = { isActive: true } as never;

const build = (owners: Partial<OwnerRepository>) => {
  const things = new FakeThingRepository();
  const events = new RecordingEventBus();
  const handler = new CreateThingHandler(
    things,
    owners as OwnerRepository,
    events,
    new PassThroughUnitOfWork(),
    new FixedClock(),
  );
  return { handler, things, events };
};

describe('CreateThingHandler', () => {
  it('creates the thing and publishes its event', async () => {
    const { handler, things, events } = build({ findByUuid: async () => activeOwner });

    await handler.execute(new CreateThingCommand('owner-1', 'widget-1', 'Widget'));

    expect(things.saved).toHaveLength(1);
    expect(things.saved[0]!.code.value).toBe('WIDGET-1');
    expect(events.published.map((e) => e.name)).toEqual(['catalog.thing.created']);
  });

  it('refuses an inactive owner', async () => {
    const { handler } = build({ findByUuid: async () => null });

    await expect(
      handler.execute(new CreateThingCommand('owner-1', 'widget-1', 'Widget')),
    ).rejects.toMatchObject({ code: 'OWNER_NOT_ACCEPTING_THINGS' });
  });

  it('refuses a duplicate code, compared after normalisation', async () => {
    const { handler } = build({ findByUuid: async () => activeOwner });
    await handler.execute(new CreateThingCommand('owner-1', 'WIDGET-1', 'Widget'));

    await expect(
      handler.execute(new CreateThingCommand('owner-1', ' widget 1 ', 'Other')),
    ).rejects.toMatchObject({ code: 'CODE_ALREADY_USED' });
  });
});
```

---

## 10. `application/queries/catalog.queries.ts`

```ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Page, PaginationParams } from '../../../../shared/pagination';
import { Thing } from '../../domain/thing';
import { ThingNotFound } from '../../domain/errors';
import { ThingRepository } from '../../domain/ports/thing-repository.port';

export class GetThingQuery {
  constructor(readonly uuid: string) {}
}

export class ListThingsQuery {
  constructor(
    readonly pagination: PaginationParams,
    readonly ownerUuid?: string,
  ) {}
}

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

@QueryHandler(ListThingsQuery)
export class ListThingsHandler implements IQueryHandler<ListThingsQuery, Page<Thing>> {
  constructor(private readonly things: ThingRepository) {}

  execute(query: ListThingsQuery): Promise<Page<Thing>> {
    return this.things.list(query.pagination, query.ownerUuid);
  }
}
```

A query handler reads only. It never publishes an event and never opens a transaction.

---

## 11. `infrastructure/persistence/thing.orm-entity.ts`

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { ThingStatus } from '../../domain/thing';

@Entity({ schema: 'catalog', name: 'things' })
export class ThingOrmEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', unique: true })
  uuid!: string;

  // The owner context owns its table; this is an id, never a foreign key.
  @Column({ type: 'uuid', name: 'owner_uuid' })
  ownerUuid!: string;

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

Registers nowhere. `platform/database/data-source.ts` finds it by the `modules/**/*.orm-entity.{ts,js}` glob.

---

## 12. `infrastructure/persistence/thing.mapper.ts`

```ts
import { Thing, ThingStatus, isThingStatus } from '../../domain/thing';
import { ThingCode } from '../../domain/value-objects/thing-code';
import { ThingOrmEntity } from './thing.orm-entity';

export const ThingMapper = {
  toDomain(row: ThingOrmEntity): Thing {
    return Thing.fromSnapshot({
      uuid: row.uuid,
      ownerUuid: row.ownerUuid,
      // fromPersistence, not of: a row predating a rule must still load.
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
    row.ownerUuid = thing.ownerUuid;
    row.code = thing.code.value;
    row.name = thing.name;
    row.status = thing.status;
    row.createdAt = thing.createdAt;
    row.updatedAt = thing.updatedAt;

    return row;
  },
};
```

---

## 13. `infrastructure/persistence/typeorm-thing.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { DataSource, Not } from 'typeorm';

import { TransactionContext, TransactionalRepository } from '../../../../platform/database';
import { Page, PaginationParams } from '../../../../shared/pagination';
import { Thing, ThingStatus } from '../../domain/thing';
import { ThingRepository } from '../../domain/ports/thing-repository.port';
import { ThingCode } from '../../domain/value-objects/thing-code';
import { ThingMapper } from './thing.mapper';
import { ThingOrmEntity } from './thing.orm-entity';

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

  async findByCode(code: ThingCode): Promise<Thing | null> {
    const row = await this.repository.findOne({ where: { code: code.value } });
    return row ? ThingMapper.toDomain(row) : null;
  }

  async list(params: PaginationParams, ownerUuid?: string): Promise<Page<Thing>> {
    const [rows, total] = await this.repository.findAndCount({
      where: ownerUuid ? { ownerUuid } : {},
      order: { id: 'DESC' },
      skip: params.offset,
      take: params.limit,
    });

    return Page.of(
      rows.map((row) => ThingMapper.toDomain(row)),
      total,
      params,
    );
  }

  async findActiveByOwner(ownerUuid: string): Promise<Thing[]> {
    const rows = await this.repository.find({
      where: { ownerUuid, status: Not(ThingStatus.Archived) },
      order: { id: 'ASC' },
    });

    return rows.map((row) => ThingMapper.toDomain(row));
  }

  async save(thing: Thing): Promise<void> {
    // Look up the internal id first, or the upsert inserts a duplicate row.
    const existing = await this.repository.findOne({
      where: { uuid: thing.uuid },
      select: { id: true },
    });

    await this.repository.save(ThingMapper.toOrm(thing, existing?.id));
  }

  async saveAll(things: readonly Thing[]): Promise<void> {
    if (things.length === 0) {
      return;
    }

    const existing = await this.repository.find({
      where: things.map((thing) => ({ uuid: thing.uuid })),
      select: { id: true, uuid: true },
    });

    const idByUuid = new Map(existing.map((row) => [row.uuid, row.id]));

    await this.repository.save(
      things.map((thing) => ThingMapper.toOrm(thing, idByUuid.get(thing.uuid))),
    );
  }
}
```

---

## 14. `infrastructure/event-handlers/archive-on-owner-deactivated.handler.ts`

```ts
import { Injectable } from '@nestjs/common';

import { Clock, EventBus } from '../../../../shared/application';
import { DurableEventHandler, EventMessage } from '../../../../platform/messaging';
import { ThingRepository } from '../../domain/ports/thing-repository.port';

/**
 * The catalog context never imports owner's internals. It knows only the event
 * name and the shape of its payload.
 */
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

    const things = await this.things.findActiveByOwner(ownerUuid);

    if (things.length === 0) {
      return;
    }

    const now = this.clock.now();

    for (const thing of things) {
      thing.archive(`owner deactivated: ${reason}`, now);
    }

    await this.things.saveAll(things);
    await this.events.publishAll(things.flatMap((thing) => thing.pullEvents()));
  }
}
```

---

## 15. `presentation/http/dto/thing.dto.ts`

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

import { Page } from '../../../../../shared/pagination';
import { Thing, ThingStatus } from '../../../domain/thing';

export class CreateThingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ownerUuid!: string;

  @ApiProperty({ example: 'WIDGET-1', description: 'Normalised to uppercase' })
  @IsString()
  @MaxLength(32)
  code!: string;

  @ApiProperty({ example: 'Widget' })
  @IsString()
  @MaxLength(128)
  name!: string;
}

export class RenameThingDto {
  @ApiProperty({ example: 'Bigger Widget' })
  @IsString()
  @MaxLength(128)
  name!: string;
}

export class ArchiveThingDto {
  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  reason?: string;
}

export class ListThingsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ownerUuid?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class ThingResponseDto {
  @ApiProperty() uuid!: string;
  @ApiProperty() ownerUuid!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Object.values(ThingStatus) }) status!: ThingStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static from(thing: Thing): ThingResponseDto {
    return {
      uuid: thing.uuid,
      ownerUuid: thing.ownerUuid,
      code: thing.code.value,
      name: thing.name,
      status: thing.status,
      createdAt: thing.createdAt.toISOString(),
      updatedAt: thing.updatedAt.toISOString(),
    };
  }
}

export class ThingPageDto {
  @ApiProperty({ type: [ThingResponseDto] }) items!: ThingResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;

  static from(page: Page<Thing>): ThingPageDto {
    return {
      items: page.items.map((thing) => ThingResponseDto.from(thing)),
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
    };
  }
}
```

The internal `id` appears nowhere. `ownerUuid` is bindable here only because this route is authenticated and administrative — on a public route it would be a privilege-bearing field and must come from `@CurrentUser()` instead.

---

## 16. `presentation/http/things.controller.ts`

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiAuthFailures,
  ApiEnvelope,
  ApiFailure,
  ApiValidationFailure,
} from '../../../../platform/http/swagger';
import { RequirePermissions } from '../../../../platform/http/decorators/authorize.decorator';
import { Page, PaginationParams } from '../../../../shared/pagination';
import {
  ArchiveThingCommand,
  CreateThingCommand,
  RenameThingCommand,
} from '../../application/commands/catalog.commands';
import { GetThingQuery, ListThingsQuery } from '../../application/queries/catalog.queries';
import { Thing } from '../../domain/thing';
import {
  ArchiveThingDto,
  CreateThingDto,
  ListThingsDto,
  RenameThingDto,
  ThingPageDto,
  ThingResponseDto,
} from './dto/thing.dto';

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
  @ApiOperation({ summary: 'Create a thing for an active owner' })
  @ApiEnvelope(ThingResponseDto, { status: 201, description: 'Created' })
  @ApiValidationFailure()
  @ApiFailure(400, 'OWNER_NOT_ACCEPTING_THINGS', 'The owner does not exist or is inactive')
  @ApiFailure(409, 'CODE_ALREADY_USED', 'Codes are compared after normalisation')
  async create(@Body() dto: CreateThingDto): Promise<ThingResponseDto> {
    const thing = await this.commands.execute<CreateThingCommand, Thing>(
      new CreateThingCommand(dto.ownerUuid, dto.code, dto.name),
    );
    return ThingResponseDto.from(thing);
  }

  @Get()
  @ApiOperation({ summary: 'List things, optionally filtered by owner' })
  @ApiEnvelope(ThingPageDto, { status: 200, description: 'A page of things' })
  async list(@Query() dto: ListThingsDto): Promise<ThingPageDto> {
    const page = await this.queries.execute<ListThingsQuery, Page<Thing>>(
      new ListThingsQuery(new PaginationParams(dto.page, dto.limit), dto.ownerUuid),
    );
    return ThingPageDto.from(page);
  }

  @Get(':uuid')
  @ApiOperation({ summary: 'Get a thing' })
  @ApiEnvelope(ThingResponseDto, { status: 200 })
  @ApiFailure(404, 'THING_NOT_FOUND')
  async get(@Param('uuid', ParseUUIDPipe) uuid: string): Promise<ThingResponseDto> {
    const thing = await this.queries.execute<GetThingQuery, Thing>(new GetThingQuery(uuid));
    return ThingResponseDto.from(thing);
  }

  @Patch(':uuid/name')
  @RequirePermissions('catalog:admin')
  @ApiOperation({ summary: 'Rename a thing' })
  @ApiEnvelope(ThingResponseDto, { status: 200 })
  @ApiValidationFailure()
  @ApiFailure(409, 'THING_ARCHIVED', 'An archived thing cannot be modified')
  async rename(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: RenameThingDto,
  ): Promise<ThingResponseDto> {
    const thing = await this.commands.execute<RenameThingCommand, Thing>(
      new RenameThingCommand(uuid, dto.name),
    );
    return ThingResponseDto.from(thing);
  }

  @Patch(':uuid/archive')
  @RequirePermissions('catalog:admin')
  @ApiOperation({ summary: 'Archive a thing' })
  @ApiEnvelope(ThingResponseDto, {
    status: 200,
    description: 'Idempotent: already archived is a success',
  })
  @ApiFailure(404, 'THING_NOT_FOUND')
  async archive(
    @Param('uuid', ParseUUIDPipe) uuid: string,
    @Body() dto: ArchiveThingDto,
  ): Promise<ThingResponseDto> {
    const thing = await this.commands.execute<ArchiveThingCommand, Thing>(
      new ArchiveThingCommand(uuid, dto.reason ?? 'archived by an operator'),
    );
    return ThingResponseDto.from(thing);
  }
}
```

---

## 17. `catalog.module.ts`

```ts
import { Module } from '@nestjs/common';

import { OwnerModule } from '../owner';
import {
  ArchiveThingHandler,
  CreateThingHandler,
  RenameThingHandler,
} from './application/commands/catalog.handlers';
import { GetThingHandler, ListThingsHandler } from './application/queries/catalog.queries';
import { ThingRepository } from './domain/ports/thing-repository.port';
import { ArchiveThingsOnOwnerDeactivated } from './infrastructure/event-handlers/archive-on-owner-deactivated.handler';
import { TypeOrmThingRepository } from './infrastructure/persistence/typeorm-thing.repository';
import { ThingsController } from './presentation/http/things.controller';

@Module({
  // For owner's OwnerRepository port only.
  imports: [OwnerModule],
  controllers: [ThingsController],
  providers: [
    { provide: ThingRepository, useClass: TypeOrmThingRepository },
    CreateThingHandler,
    RenameThingHandler,
    ArchiveThingHandler,
    GetThingHandler,
    ListThingsHandler,
    ArchiveThingsOnOwnerDeactivated,
  ],
  exports: [ThingRepository],
})
export class CatalogModule {}
```

---

## 18. `index.ts`

```ts
export { CatalogModule } from './catalog.module';
export { ThingRepository } from './domain/ports/thing-repository.port';
export { Thing, ThingStatus } from './domain/thing';
export { ThingCode } from './domain/value-objects/thing-code';
export { ThingArchived, ThingCreated, ThingRenamed } from './domain/events';
```

Nothing else leaves. This is the contract every other context is held to by `check:arch`.

---

## 19. `src/database/migrations/<timestamp>-CreateCatalogThings.ts`

```bash
make migrate-create NAME=CreateCatalogThings
```

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalogThings1785940000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE SCHEMA IF NOT EXISTS catalog');

    await queryRunner.query(`
      CREATE TABLE catalog.things (
          id          BIGSERIAL PRIMARY KEY,
          uuid        UUID NOT NULL UNIQUE,
          owner_uuid  UUID NOT NULL,
          code        VARCHAR(32) NOT NULL UNIQUE,
          name        VARCHAR(128) NOT NULL,
          status      VARCHAR(32) NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // "Every non-archived thing for this owner" is what the deactivation
    // reaction runs, so the index covers exactly that and nothing else.
    await queryRunner.query(`
      CREATE INDEX things_unarchived_owner_idx
          ON catalog.things (owner_uuid)
       WHERE status <> 'ARCHIVED'
    `);

    // owner_uuid is an id, not a foreign key. A cross-schema FK would have to
    // be dropped before either context could be extracted (AGENTS.md §13).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE catalog.things');
    await queryRunner.query('DROP SCHEMA IF EXISTS catalog');
  }
}
```

No explicit index on `uuid` — the `UNIQUE` constraint already made one.

---

## 20. `src/app.module.ts`

Add the import alongside the other contexts, which stay below `HttpModule`:

```ts
    HttpModule,
    HealthModule,
    IdentityModule,
    AuthModule,
    RbacModule,
    NotificationModule,
    OwnerModule,
    CarModule,
    CatalogModule,
```

---

## 21. `src/database/seeds/rbac.catalog.ts`

Only because a real route now enforces it:

```ts
{ name: 'catalog:admin', description: 'Create, rename and archive things' },
```

and add it to the `admin` role's permission list (which is `SEED_PERMISSIONS.map(p => p.name)`, so it is picked up automatically). Then `make seed`.

---

## Order of gates while writing

```bash
pnpm typecheck && pnpm check:arch     # after step 2, and after every step from 6 on
pnpm test                             # after step 3, then after step 9
make migrate-up && make migrate-down && make migrate-up   # prove down() before building on it
make check                            # before calling it done
```
