# volunteers-py

## Development

add `127.0.0.1	nerc-volunteers.itmo.ru` to `/etc/hosts`
then run `caddy run` (might ask for sudo)

## UI

```bash
cd ui
npm install
npm run dev
```

## backend

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


## TODO:

- [X] Add more fields in the registration form and gray it out if user have already filled the form, allowing to edit it with a click of a button
- [X] Telegram user migration mechanism
- [X] Day Position assignment table
- [X] Experience in the assignment table
- [X] Experiment with a sliding drawer for the users
- [ ] Scores
- [ ] Hall manager positions
- [ ] Attendance
- [ ] Year specific positions should be copied from the previous year with theirs scores saved
- [ ] Diploma generation
- [ ] csv export
- [ ] Reactive assignments broadcasts
- [ ] swap halls and positions so that positions are inside halls.
- [ ] Gender in regestration form
- [ ] Notifications by selecting users
