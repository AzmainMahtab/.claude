# nest-kit — Platform & Shared API Reference

Exact signatures of everything a bounded context consumes. Read this instead of guessing an API or inventing a helper. Paths are relative to `nest-kit/src/`.

---

## `shared/application` — the cross-context ports

Import from the barrel: `import { Clock, EventBus, UnitOfWork } from '../../../../shared/application';`

```ts
// ports/clock.port.ts
export abstract class Clock {
  abstract now(): Date;
}

// ports/event-bus.port.ts
export abstract class EventBus {
  abstract publish(event: DomainEvent): Promise<void>;
  abstract publishAll(events: readonly DomainEvent[]): Promise<void>;
}

// ports/unit-of-work.port.ts
export abstract class UnitOfWork {
  abstract withTransaction<T>(work: () => Promise<T>): Promise<T>;
}

// ports/hasher.port.ts
export abstract class Hasher {
  abstract hash(plaintext: string): Promise<string>;
  abstract verify(hash: string, plaintext: string): Promise<boolean>;
}

// ports/token-blacklist.port.ts
export abstract class TokenBlacklist {
  abstract revoke(jti: string, expiresAt: Date): Promise<void>;
  abstract isRevoked(jti: string): Promise<boolean>;
}

// ports/tokenizer.port.ts
export type TokenType = 'access' | 'refresh';
export interface TokenClaims { sub: string; jti: string; sid: string; typ: TokenType; exp: number; }
export interface IssuedToken { token: string; jti: string; expiresAt: Date; }
export abstract class Tokenizer {
  abstract issueAccess(sub: string, sid: string): Promise<IssuedToken>;
  abstract issueRefresh(sub: string, sid: string): Promise<IssuedToken>;
  abstract parseAccess(token: string): Promise<TokenClaims>;
  abstract parseRefresh(token: string): Promise<TokenClaims>;
}

// ports/access-control.port.ts — implemented by the rbac context, read by the guard
export interface Grants {
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
}
export const NO_GRANTS: Grants = { roles: [], permissions: [] };
export abstract class AccessControl {
  abstract grantsFor(userUuid: string): Promise<Grants>;
}

// ports/message-publisher.port.ts — the outbox relay is its only caller
export abstract class MessagePublisher {
  abstract publish(subject: string, payload: Uint8Array, messageId: string): Promise<void>;
  abstract isReady(): boolean;
}
```

A port belongs in `shared/` only if **two or more** contexts genuinely need it. One context's repository port goes in that context's `domain/ports/`.

---

## `shared/domain` — the event base class

```ts
export abstract class DomainEvent {
  abstract readonly name: string;

  readonly version: string = '1';
  readonly idempotencyKey: string = uuidv7();
  readonly occurredAt: Date = new Date();
}
```

Subclass convention: `readonly name = '<context>.<aggregate>.<past-tense-verb>';` plus a constructor of `readonly` primitive payload fields calling `super()`.

---

## `shared/errors` — the one error model

```ts
export interface ErrorItem { field: string; code: string; message: string; }

export class AppError extends Error {
  readonly details: ErrorItem[];

  constructor(
    readonly kind: ErrorKind,
    readonly code: string,
    message: string,
    details: ErrorItem[] = [],
    override readonly cause?: unknown,
  );

  get status(): number;

  /** Returns a NEW AppError with the item appended — it does not mutate. */
  withField(field: string, message: string, code?: string): AppError;

  static notFound(code: string, message: string): AppError;
  static conflict(code: string, message: string): AppError;
  static invalid(code: string, message: string): AppError;
  static unauthorized(code: string, message: string): AppError;
  static forbidden(code: string, message: string): AppError;
  static rateLimited(code: string, message: string): AppError;
  static validation(field: string, message: string, code?: string): AppError;   // code defaults to 'VALIDATION_FAILED'
  static internal(cause: unknown, code?: string): AppError;                     // code defaults to 'INTERNAL_ERROR'
  static is(err: unknown, code?: string): err is AppError;
}
```

```ts
export const ErrorKind = {
  NotFound: 'NOT_FOUND', Conflict: 'CONFLICT', Invalid: 'INVALID',
  Unauthorized: 'UNAUTHORIZED', Forbidden: 'FORBIDDEN',
  RateLimited: 'RATE_LIMITED', Internal: 'INTERNAL',
} as const;

export const ERROR_KIND_STATUS: Record<ErrorKind, number> = {
  NOT_FOUND: 404, CONFLICT: 409, INVALID: 400,
  UNAUTHORIZED: 401, FORBIDDEN: 403, RATE_LIMITED: 429, INTERNAL: 500,
};
```

`kind` picks the HTTP status; `code` travels to the client as data. Adding a code touches no controller and no filter. `INTERNAL` never serializes its `cause` — the filter logs it and emits a generic message.

---

## `shared/pagination`

```ts
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export class PaginationParams {
  readonly page: number;
  readonly limit: number;
  constructor(page?: number, limit?: number);   // clamps: page >= 1, limit in [1, MAX_PAGE_SIZE]
  get offset(): number;
}

export class Page<T> {
  readonly totalPages: number;
  constructor(items: readonly T[], total: number, page: number, limit: number);
  static of<T>(items: readonly T[], total: number, params: PaginationParams): Page<T>;
  map<U>(fn: (item: T) => U): Page<U>;
}
```

Clamping lives in the constructor, so a controller never bounds `limit` by hand.

---

## `shared/auth-context`

```ts
export interface CurrentUser { ... }
export const CURRENT_USER_KEY = 'currentUser';
```

The **type** only — `shared/` is framework-free. The `@CurrentUser()` decorator lives in `platform/http/decorators/`. Any context may import the type; no context may import `modules/auth/presentation/`.

---

## `platform/database` — transactions

```ts
export abstract class TransactionalRepository {
  constructor(dataSource: DataSource, context: TransactionContext);
  protected manager(): EntityManager;   // the transactional manager if one is open, else the default
}

export interface TransactionScope {
  readonly manager: EntityManager;
  readonly events: DomainEvent[];
}

@Injectable()
export class TransactionContext {
  current(): TransactionScope | undefined;
  currentManager(): EntityManager | undefined;
  run<T>(scope: TransactionScope, work: () => Promise<T>): Promise<T>;
}
```

Every repository method calls `this.manager()` **per call**. Never capture the manager in a field — that is what makes `uow.withTransaction` transparent.

Nested `withTransaction` calls join the transaction in progress rather than opening a savepoint, and only the outermost call flushes the outbox. In-process `@EventsHandler`s are dispatched only *after* the commit, so a handler never sees a rolled-back write.

A new `*.orm-entity.ts` registers nowhere: `buildDataSourceOptions` discovers it by the `modules/**/*.orm-entity.{ts,js}` glob, with `synchronize: false` in every environment including test.

---

## `platform/messaging` — durable consumers

```ts
export interface EventMessage {
  name: string;
  version: string;
  idempotencyKey: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export abstract class DurableEventHandler {
  /** Stable durable name. Changing it makes NATS replay from the start. */
  abstract readonly consumerName: string;

  /** Event names, without the `evt.` prefix. Wildcards allowed. */
  abstract readonly subjects: string[];

  abstract handle(event: EventMessage): Promise<void>;
}
```

`DurableConsumerService` discovers subclasses via `DiscoveryService`, so there is no central registry — but the handler must be a provider in its own context's module. `handle` runs inside a transaction that also records the `messaging.processed_events` marker, so a throw rolls back both and the message is redelivered. Delivery is at-least-once regardless: handlers must tolerate redelivery. After `DURABLE_MAX_DELIVER` failures the message is terminated into `messaging.dead_letters`.

Stream constants: `STREAM_NAME = 'DOMAIN_EVENTS'`, `SUBJECT_PREFIX = 'evt'`.

---

## `platform/http/swagger`

```ts
interface EnvelopeOptions { status: number; description?: string; }

export function ApiEnvelope<T extends Type<unknown>>(model: T, options: EnvelopeOptions);
export function ApiEnvelopeArray<T extends Type<unknown>>(model: T, options: EnvelopeOptions);
export function ApiFailure(status: number, code: string, description?: string);
export function ApiAuthFailures();        // ApiFailure(401, 'MISSING_TOKEN', ...)
export function ApiValidationFailure();   // ApiFailure(400, 'VALIDATION_FAILED', ...)
```

Use these instead of `@ApiResponse({ type: Dto })`, which describes only the inner object and is therefore wrong for every route in this application — the interceptor sends `{ success, data }`.

---

## `platform/http/decorators`

There is **no barrel here** — import the specific file, as the real controllers do:

```ts
import { RequirePermissions } from '../../../../platform/http/decorators/authorize.decorator';
import { CurrentUser } from '../../../../platform/http/decorators/current-user.decorator';
import { Public } from '../../../../platform/http/decorators/public.decorator';
import { AuthRateLimit } from '../../../../platform/http/decorators/rate-limit.decorator';
```

```ts
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePermissions = (...permissions: string[]) => ...;   // any-of; attaches AuthorizationGuard itself
export const RequireRoles = (...roles: string[]) => ...;               // the escape hatch — prefer permissions

export const CurrentUser = createParamDecorator(...);   // throws if used on an unauthenticated route

export interface RateLimitBudget { scope: string; limit: number; windowSeconds: number; }
export type RateLimitSetting = 'default' | 'auth' | 'none' | RateLimitBudget;
export const RateLimit = (setting: RateLimitSetting) => ...;
export const AuthRateLimit = () => ...;   // anything that takes a credential
export const NoRateLimit = () => ...;     // probes only
```

Authentication is global and deny-by-default (`JwtAuthGuard` as `APP_GUARD` in `AuthModule`), so `@Public()` marks the exceptions. Authorization is opt-in per route. `AuthorizationGuard` ships attached to the decorator rather than as a second global guard, because two global guards would depend on module resolution order to see the `CurrentUser` the first one attaches.

Permission names are lowercase `resource:action`. Case is **rejected**, not folded.

---

## `platform/http` — global wiring

```ts
export function configureApp(app: INestApplication): void;
```

Registers the validation pipe (`whitelist: true, forbidNonWhitelisted: true, transform: true`), `AppErrorFilter`, `ResponseEnvelopeInterceptor`, and URI versioning (`/api/v1/...`). Called by `main.ts` **and by every e2e spec** — an e2e that skips it tests a different application.

---

## `check:arch` — the seven rules and their verbatim messages

`scripts/check-arch.mjs` walks every `.ts` under `src/`. Framework packages are `@nestjs/`, `typeorm`, `ioredis`, `redis`, `express`, `class-validator`, `class-transformer`, `rxjs`.

| Rule | Applies to | Message |
|---|---|---|
| Pure core | `src/shared/**`, `modules/*/domain/**` | `imports framework package '<specifier>' (AGENTS.md §2)` |
| Platform isolation | `src/shared/**`, `domain/`, `application/` | `imports platform code '<specifier>' (AGENTS.md §2)` |
| Domain inward | `domain/` | `domain imports <layer>/ (AGENTS.md §2)` |
| Application inward | `application/` | `application imports <layer>/ (AGENTS.md §2)` |
| Context boundary | any context file (specs exempt) | `reaches into context '<ctx>' at '<specifier>' — import 'src/modules/<ctx>' or react to its events (AGENTS.md §13)` |
| Config only | everything outside `platform/config/` | `reads process.env directly — inject AppConfig instead (AGENTS.md §9)` |

On failure it prints `✗ architecture check failed (<n>):` followed by one `<path>: <message>` line each, and exits 1. On success: `✓ architecture check passed`.

Consequences worth remembering: `infrastructure/` and `presentation/` **may** import `platform/`; `domain/` and `application/` may not. Specs are exempt from the cross-context rule only — never from the others.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm lint:fix` | eslint over `{src,test}` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm check:arch` | the gate above |
| `pnpm test` | unit specs only (`rootDir: src`, `*.spec.ts`) |
| `pnpm test:e2e` | `test/*.e2e-spec.ts`, `--runInBand`, needs real infrastructure |
| `pnpm check` / `make check` | lint + typecheck + check:arch + test |
| `make migrate-create NAME=X` | new migration in `src/database/migrations/` |
| `make migrate-up` / `migrate-down` / `migrate-status` | apply / revert / list |
| `make seed` | idempotent role + permission catalogue and first admin |
| `make db-up` / `db-down` | Postgres, Redis, NATS for tests |
| `make keygen` | ES256 keypair into `certs/` |
| `pnpm openapi:export` | regenerate `openapi.json` |

`pnpm check` does **not** run e2e. Run it separately after `make db-up && make migrate-up`.

---

## Seed catalogue shape

`src/database/seeds/rbac.catalog.ts`:

```ts
export interface SeedPermission { readonly name: string; readonly description: string; }

export interface SeedRole {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly string[];
  /** Protected roles can gain permissions but never lose one. Only `admin`. */
  readonly isProtected: boolean;
}

export const SEED_PERMISSIONS: readonly SeedPermission[] = [...];
export const SEED_ROLES: readonly SeedRole[] = [...];
export const ADMIN_ROLE_NAME = 'admin';
```

Additive and idempotent: grant what the catalogue lists, never revoke what it does not. A migration's inline seed is frozen history; this file is where the catalogue grows. Every permission here must be required by a real route.
