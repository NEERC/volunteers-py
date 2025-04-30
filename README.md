# volunteers-py

## Development

```bash
poetry install
poetry run ruff check
pre-commit install
uvicorn volunteers.app:app --reload
```

## Structure
```
┌───────────────────────────┐
│  Presentation (FastAPI)   │  ← HTTP, GraphQL, CLI, Celery tasks …
├───────────────────────────┤
│  Application / Service    │  ← Use-cases, commands, orchestrates work
├───────────────────────────┤
│  Domain                   │  ← Entities, Value Objects, Aggregates, Domain Events
├───────────────────────────┤
│  Infrastructure / Adapters│  ← SQLAlchemy, Redis, Email, 3rd-party APIs
└───────────────────────────┘
```

```
volunteers/
├── api/
│   └── v1/ # Controllers for API v1
├── core/
│   ├── di.py # Dependency injection
│   ├── db.py # Database connection
│   ├── config.py # Configuration
│   └── logger.py # Logger
├── models/
│   └── base.py # base model for ORM models
├── schemas/
│   └── base.py # Base schema for Pydantic models - both request and response
├── services/
│   └── base.py # Base service for business logic
├── utils/
├── auth/ # Auth services
├── tests/
└── __main__.py

```
