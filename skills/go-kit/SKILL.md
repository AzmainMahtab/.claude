# Go Kit Module Skill

Use this skill when asked to implement a new bounded context, use case, endpoint, adapter, or migration in `go-kit`.

`go-kit` is a **modular monolith**: Hexagonal (ports & adapters) + DDD + CQRS, sliced **vertically** by bounded context. Every context owns its full stack. Read `go-kit/AGENTS.md` for the authoritative rules before writing anything.

## Step 1 — Orient with the Graph

```bash
graphify query "<feature name>"      # discover existing related nodes
cat graphify-out/GRAPH_REPORT.md     # confirm god nodes and hyperedges
```

Then read an analogous existing context (`internal/modules/identity/` or `internal/modules/auth/`) end to end. Do NOT invent patterns.

## Step 2 — Domain Layer First (zero framework imports)

`internal/modules/<ctx>/domain/` may import stdlib, `github.com/google/uuid`, and `internal/shared/*` value objects. Nothing else. No chi, no sqlx, no redis, no nats.

### Entities (`domain/<entity>.go`)

Identity is always the **public UUID**. The persistence surrogate key never appears in the domain.

```go
type Thing struct {
    ID        uuid.UUID       // public identity (UUIDv7)
    Name      ThingName       // value object, not a raw string
    OwnerID   uuid.UUID
    Status    ThingStatus
    CreatedAt time.Time
    DeletedAt *time.Time
}

func (t *Thing) IsActive() bool { return t.DeletedAt == nil && t.Status == ThingStatusActive }
```

Entities carry behaviour. If a rule can be expressed on the aggregate, it belongs here — not in a use case.

```go
func (t *Thing) TransitionStatus(to ThingStatus) error {
    allowed := map[ThingStatus][]ThingStatus{
        ThingStatusDraft:  {ThingStatusActive, ThingStatusArchived},
        ThingStatusActive: {ThingStatusArchived},
    }
    for _, candidate := range allowed[t.Status] {
        if candidate == to {
            t.Status = to
            return nil
        }
    }
    return ErrInvalidStatusTransition
}
```

### Value Objects

Immutable, self-validating, unexported field, constructor returns an error. Use one for any concept with validation rules.

```go
type ThingName struct{ value string }

func NewThingName(v string) (ThingName, error) {
    v = strings.TrimSpace(v)
    if v == "" {
        return ThingName{}, apperrors.Validation("name", "name is required")
    }
    if len(v) > 100 {
        return ThingName{}, apperrors.Validation("name", "name cannot exceed 100 characters")
    }
    return ThingName{value: v}, nil
}

func (n ThingName) String() string { return n.value }
```

Rules: never export the field; validate AND normalize in the constructor; return an `*apperrors.AppError`, never a bare `errors.New`.

### Ports (`domain/repository.go`)

Ports are defined **by the consumer, in the context that needs them** — never in a central `ports/` package.

```go
type ThingRepository interface {
    GetByID(ctx context.Context, id uuid.UUID) (*Thing, error)
    Save(ctx context.Context, thing *Thing) error
    Update(ctx context.Context, thing *Thing) error
    List(ctx context.Context, offset, limit int) ([]*Thing, int, error)
}
```

Repositories return `(nil, nil)` for "not found" — never a sentinel error. The use case decides what absence means.

### Domain Events (`domain/events.go`)

```go
type ThingCreatedEvent struct {
    ThingID    uuid.UUID `json:"thing_id"`
    OwnerID    uuid.UUID `json:"owner_id"`
    OccurredAt time.Time `json:"occurred_at"`
}

func (ThingCreatedEvent) EventName() string { return "catalog.thing.created" }

var _ eventbus.Event = ThingCreatedEvent{}
```

Event names are `<context>.<aggregate>.<past_tense_verb>`. Always assert the interface with a `var _` line.

### Domain Errors (`domain/errors.go`)

Constructors, not bare sentinels — so the HTTP layer never needs a per-module mapper.

```go
var (
    ErrThingNotFound           = apperrors.NotFound("THING_NOT_FOUND", "thing not found")
    ErrInvalidStatusTransition = apperrors.Invalid("INVALID_STATUS_TRANSITION", "invalid status transition")
)
```

## Step 3 — Application Layer (CQRS)

`application/dto.go` holds commands, queries, and results. Validation tags live here so the use case can validate its own input.

```go
type CreateThingCommand struct {
    Name    string    `validate:"required,max=100"`
    OwnerID uuid.UUID `validate:"required"`
}

type ThingResult struct {
    ID        uuid.UUID `json:"id"`
    Name      string    `json:"name"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"created_at"`
}

func ToThingResult(t *domain.Thing) ThingResult { ... }
```

### Command (`application/commands/create_thing.go`)

One struct per use case. Constructor injection of ports only — never a concrete adapter.

```go
type CreateThing struct {
    repo  domain.ThingRepository
    bus   eventbus.EventBus
    audit audit.Publisher
    v     validator.Validator
}

func NewCreateThing(repo domain.ThingRepository, bus eventbus.EventBus, audit audit.Publisher, v validator.Validator) *CreateThing {
    return &CreateThing{repo: repo, bus: bus, audit: audit, v: v}
}

func (uc *CreateThing) Handle(ctx context.Context, cmd application.CreateThingCommand) (application.ThingResult, error) {
    if err := uc.v.ValidateStruct(cmd); err != nil {
        return application.ThingResult{}, err
    }

    name, err := domain.NewThingName(cmd.Name)
    if err != nil {
        return application.ThingResult{}, err
    }

    now := time.Now().UTC()
    thing := &domain.Thing{
        ID:        idgenerator.NewUUIDv7(),
        Name:      name,
        OwnerID:   cmd.OwnerID,
        Status:    domain.ThingStatusDraft,
        CreatedAt: now,
    }

    if err := uc.repo.Save(ctx, thing); err != nil {
        return application.ThingResult{}, err
    }

    _ = uc.bus.Publish(ctx, domain.ThingCreatedEvent{
        ThingID: thing.ID, OwnerID: thing.OwnerID, OccurredAt: now,
    })

    return application.ToThingResult(thing), nil
}
```

Ordering is fixed: **validate → construct value objects → apply domain rules → persist → publish → return**. Never publish before persisting.

Queries go in `application/queries/` with an `Execute` method and are read-only.

## Step 4 — Infrastructure

### Model + Mapper (`infrastructure/persistence/`)

The model is the only place the **BIGSERIAL internal id** exists. It never crosses into the domain.

```go
type thingModel struct {
    InternalID int64        `db:"id"`      // surrogate key — persistence only
    UUID       string       `db:"uuid"`    // public identity
    Name       string       `db:"name"`
    Status     string       `db:"status"`
    CreatedAt  time.Time    `db:"created_at"`
    DeletedAt  sql.NullTime `db:"deleted_at"`
}

func thingToDomain(m thingModel) (*domain.Thing, error) { ... }  // parses UUID, rebuilds VOs
func thingToModel(t *domain.Thing) thingModel          { ... }  // leaves InternalID zero on insert
```

### Repository

Always go through `r.exec(ctx)` so the use case can wrap the call in a transaction without the repo knowing.

```go
func (r *PostgresThingRepository) exec(ctx context.Context) database.Executor {
    if r.tx != nil {
        return r.tx.Executor(ctx)
    }
    return r.db
}
```

Every query is parameterized or named-bound. Never string-concatenate SQL. Foreign keys reference the internal `BIGINT`, resolved with an `INSERT ... SELECT` on the parent's `uuid`.

## Step 5 — Presentation (`presentation/http/`)

`requests.go` — DTOs with validate tags and a `ToCommand()`. Never accept a field the caller must not control (role, status, owner) on a public endpoint.

`responses.go` — response shapes and `From*Result()` mappers.

`handlers.go` — decode, authorize, delegate, respond. No business logic.

```go
func (h *ThingHandler) Create(w http.ResponseWriter, r *http.Request) {
    var req CreateThingRequest
    if err := decodeAndValidate(r, h.v, &req); err != nil {
        responses.HandleError(w, err)
        return
    }

    current, ok := authctx.CurrentUserFromContext(r.Context())
    if !ok {
        responses.HandleError(w, apperrors.ErrUnauthenticated)
        return
    }

    result, err := h.create.Handle(r.Context(), req.ToCommand(current.UserID))
    if err != nil {
        responses.HandleError(w, err)   // ONE mapper — never a per-module switch
        return
    }

    responses.Created(w, FromThingResult(result))
}
```

`router.go` — public routes first, protected routes inside a `Group` with the auth middleware.

## Step 6 — Module Facade (`module.go`)

The only file the composition root talks to.

```go
type Deps struct {
    DB     *sqlx.DB
    Tx     *database.TxManager
    Bus    eventbus.EventBus
    Audit  audit.Publisher
    V      validator.Validator
    AuthMW func(http.Handler) http.Handler
}

func NewModule(deps Deps) *Module {
    repo := persistence.NewPostgresThingRepository(deps.DB, deps.Tx)
    create := commands.NewCreateThing(repo, deps.Bus, deps.Audit, deps.V)
    handler := thingHTTP.NewThingHandler(create, deps.V)
    return &Module{thingRouter: thingHTTP.NewThingRouter(handler, deps.AuthMW)}
}

func (m *Module) ThingRouter() chi.Router { return m.thingRouter }
```

## Step 7 — Wire the Composition Root

`cmd/api/main.go` builds adapters once and passes them in. It contains no logic.

```go
thingModule := thing.NewModule(thing.Deps{
    DB: db, Tx: txManager, Bus: bus, Audit: auditPublisher, V: v, AuthMW: authMW.Authenticate,
})

server := platformhttp.NewServer(platformhttp.ServerDeps{
    ...,
    ThingRouter: thingModule.ThingRouter(),
})
```

Mount the route in `internal/platform/http/server.go`, not in main.

## Step 8 — Migration

```bash
cd go-kit
make migrate-create NAME=create_things_table
make migrate-up
```

Every table follows the ID convention:

```sql
-- +goose Up
CREATE TABLE catalog.things (
    id          BIGSERIAL PRIMARY KEY,
    uuid        UUID NOT NULL UNIQUE,
    owner_id    BIGINT NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    status      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- No explicit index on uuid: the UNIQUE constraint already creates one.
CREATE INDEX idx_things_owner_id ON catalog.things(owner_id);
CREATE UNIQUE INDEX idx_things_active_name ON catalog.things(name) WHERE deleted_at IS NULL;

-- +goose Down
DROP TABLE catalog.things;
```

## Step 9 — Tests

Table-driven, in-memory fakes implementing the port. Never mock the DB.

```go
func TestCreateThing(t *testing.T) {
    tests := []struct {
        name    string
        cmd     application.CreateThingCommand
        wantErr error
    }{
        {"valid", application.CreateThingCommand{Name: "Widget", OwnerID: uuid.New()}, nil},
        {"blank name", application.CreateThingCommand{Name: "  ", OwnerID: uuid.New()}, apperrors.ErrValidation},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            uc := commands.NewCreateThing(newFakeThingRepo(), eventbus.Noop{}, audit.NoopPublisher{}, validator.New())
            _, err := uc.Handle(context.Background(), tt.cmd)
            if !errors.Is(err, tt.wantErr) {
                t.Fatalf("got %v, want %v", err, tt.wantErr)
            }
        })
    }
}
```

Test files sit next to the code (`create_thing_test.go`). One test per behaviour.

## Quality Gates (run before finishing)

```bash
cd go-kit
gofmt -l .              # must print nothing
go vet ./...
golangci-lint run
go test -race -cover ./...
go build ./...
```

Or in one shot: `make check`

## Hard Rules

- `domain/` imports zero frameworks. Verify with `make check-arch`.
- Ports are defined by consumers, inside their context — never a shared `ports/` package.
- One error model: return `*apperrors.AppError`, map with `responses.HandleError`. Never write a per-module `mapError`.
- The internal `BIGSERIAL` id never leaves `infrastructure/persistence/`.
- Public endpoints never accept privilege-bearing fields (`role`, `status`, `owner_id`) from the request body.
- Cross-context reads go through the event bus or an explicit port on `Deps` — never by importing another context's `presentation/` package.
- NEVER add comments unless asked. NEVER create README files unless asked. NEVER commit unless asked.
