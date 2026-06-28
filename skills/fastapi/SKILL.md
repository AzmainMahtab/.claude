# FastAPI Module Skill

Use this skill when asked to implement a new FastAPI module, use case, endpoint, or migration in MTNS Academy.

## Step 1 — Orient with the Graph

```bash
graphify query "<feature name>"      # discover existing related nodes
cat graphify-out/GRAPH_REPORT.md     # confirm god nodes and hyperedges
```

Read `mtns-academy-backend/AGENTS.md` for the authoritative rules. Read an analogous existing module (e.g. `app/modules/user/` or `app/modules/auth/`) before writing anything.

## Step 2 — Design Domain Layer First (no framework imports)

### Entities (`domain/entities.py`)

Entities have identity (ID) and mutable state. They hold value objects as fields — never raw primitives for validated concepts.

```python
@dataclass
class Thing:
    id: UUID
    name: ThingName          # value object, not raw str
    owner_id: UUID
    status: ThingStatus
```

### Value Objects (`domain/value_objects.py`)

Value objects are **immutable**, **self-validating**, and **interchangeable by value**. Use them for any concept with validation rules — email, phone, name, code, amount, etc. They raise domain exceptions on invalid input, so use cases never need to re-validate.

```python
@dataclass(frozen=True)
class ThingName:
    value: str

    def __post_init__(self) -> None:
        stripped = self.value.strip()
        if not stripped:
            raise ThingNameError("Name cannot be blank")
        if len(stripped) > 100:
            raise ThingNameError("Name cannot exceed 100 characters")
        object.__setattr__(self, "value", stripped)   # normalize in-place (frozen safe)

@dataclass(frozen=True)
class ThingCode:
    value: str

    def __post_init__(self) -> None:
        if not self.value.isalnum():
            raise ThingCodeError("Code must be alphanumeric")
        object.__setattr__(self, "value", self.value.upper())
```

**Rules for value objects:**
- Always `@dataclass(frozen=True)` — immutability is the point
- Validate AND normalize in `__post_init__` (strip whitespace, uppercase codes, etc.)
- Use `object.__setattr__` to normalize a frozen field in `__post_init__`
- Never import FastAPI, SQLAlchemy, Pydantic, or any framework
- Raise a specific domain exception (`*Error` subclassing `AppException`), not `ValueError`
- The use case constructs the value object from raw command data — validation happens there, not in the API schema

### Interfaces (`domain/interfaces.py`)

```python
class IThingRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: UUID) -> Thing | None: ...
    @abstractmethod
    async def save(self, thing: Thing) -> None: ...
    @abstractmethod
    async def delete(self, id: UUID) -> None: ...
```

### Domain Events (`domain/events.py`)

```python
@dataclass(frozen=True)
class ThingCreatedEvent:
    thing_id: UUID
```

### Domain Exceptions (`domain/exceptions.py`)

```python
class ThingNotFoundError(AppException):
    status_code = 404
    code = "THING_NOT_FOUND"

class ThingNameError(AppException):
    status_code = 400
    code = "INVALID_THING_NAME"

class ThingCodeError(AppException):
    status_code = 400
    code = "INVALID_THING_CODE"
```

## Step 3 — CQRS Dataclasses

```python
# cqrs/command.py
@dataclass(frozen=True)
class CreateThingCommand:
    name: str
    owner_id: UUID

# cqrs/query.py
@dataclass(frozen=True)
class GetThingQuery:
    thing_id: UUID

# cqrs/result.py
@dataclass(frozen=True)
class CreateThingResult:
    thing: Thing
```

## Step 4 — Use Case

```python
# use_cases/create_thing.py
class CreateThingUseCase:
    def __init__(self, repo: IThingRepository, event_bus: IEventBus):
        self.repo = repo
        self.event_bus = event_bus

    async def execute(self, command: CreateThingCommand) -> CreateThingResult:
        name = ThingName(command.name)           # raises ThingNameError if invalid
        thing = Thing(id=uuid7(), name=name, status=ThingStatus.ACTIVE)  # store VO, not .value
        await self.repo.save(thing)
        await self.event_bus.publish(ThingCreatedEvent(thing_id=thing.id))
        return CreateThingResult(thing=thing)
```

## Step 5 — API Layer

```python
# api/schemas.py
class CreateThingRequest(BaseModel):
    name: str
    def to_command(self, owner_id: UUID) -> CreateThingCommand:
        return CreateThingCommand(name=self.name, owner_id=owner_id)

class ThingResponse(BaseModel):
    id: UUID
    name: str
    @classmethod
    def from_entity(cls, thing: Thing) -> "ThingResponse":
        return cls(id=thing.id, name=thing.name.value)   # unwrap VO for serialization

# api/router.py
router = APIRouter(prefix="/things", tags=["things"])

@router.post("/", response_model=SuccessEnvelope[ThingResponse], status_code=201)
async def create_thing(
    body: CreateThingRequest,
    current_user: User = Depends(require_authenticated_user),
    use_case: CreateThingUseCase = Depends(get_create_thing_use_case),
):
    result = await use_case.execute(body.to_command(owner_id=current_user.id))
    return SuccessEnvelope(data=ThingResponse.from_entity(result.thing))
```

## Step 6 — Infrastructure

```python
# infrastructure/persistence/models.py
class ThingModel(Base, BaseModelMixin):
    __tablename__ = "things"
    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str]
    status: Mapped[str]

# infrastructure/persistence/mapper.py
def map_to_domain(model: ThingModel) -> Thing:
    return Thing(id=model.id, name=ThingName(model.name), status=ThingStatus(model.status))

# infrastructure/persistence/repository.py
class SQLAlchemyThingRepository(IThingRepository):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save(self, thing: Thing) -> None:
        model = ThingModel(id=thing.id, name=thing.name.value, status=thing.status.value)  # unwrap VOs for persistence
        self.db.add(model)
        await self.db.flush()
```

## Step 7 — DI Wiring

```python
# api/dependencies.py
async def get_thing_repo(db: AsyncSession = Depends(get_db)) -> IThingRepository:
    return SQLAlchemyThingRepository(db)

async def get_create_thing_use_case(
    repo: IThingRepository = Depends(get_thing_repo),
    event_bus: IEventBus = Depends(get_event_bus),
) -> CreateThingUseCase:
    return CreateThingUseCase(repo=repo, event_bus=event_bus)
```

## Step 8 — Register in main.py

```python
# In lifespan: register event handlers
event_bus.subscribe(ThingCreatedEvent, create_some_handler(deps))

# Include router
app.include_router(things_router, prefix="/api/v1")
```

## Step 9 — Tests

```python
# tests/test_create_thing.py
async def test_create_thing_success():
    repo = InMemoryThingRepository()
    bus = InMemoryEventBus()
    use_case = CreateThingUseCase(repo=repo, event_bus=bus)
    result = await use_case.execute(CreateThingCommand(name="Test", owner_id=uuid4()))
    assert result.thing.name == "Test"
    assert len(bus.events) == 1

async def test_create_thing_blank_name_raises():
    use_case = CreateThingUseCase(InMemoryThingRepository(), InMemoryEventBus())
    with pytest.raises(ThingNameError):
        await use_case.execute(CreateThingCommand(name="  ", owner_id=uuid4()))
```

## Step 10 — Migration

```bash
cd mtns-academy-backend
uv run alembic revision --autogenerate -m "add_things_table"
uv run alembic upgrade head
```

## Quality Gates

```bash
uv run ruff check app/ && uv run ruff format app/
uv run mypy app/
uv run pytest
```
