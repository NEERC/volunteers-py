ARG PYTHON_VERSION="3.13"
ARG POETRY_VERSION="2.2.1"

FROM python:${PYTHON_VERSION}-slim AS python-base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100

FROM python-base AS backend-build

ARG POETRY_VERSION

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_OPTIONS_ALWAYS_COPY=true \
    POETRY_CACHE_DIR='/var/cache/pypoetry' \
    POETRY_HOME='/opt/poetry' \
    POETRY_VERSION=$POETRY_VERSION

ENV PATH="$POETRY_HOME/bin:$PATH"

RUN apt-get update \
    && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR /app
COPY pyproject.toml poetry.lock /app/

RUN --mount=type=cache,id=poetry,target=$POETRY_CACHE_DIR \
    poetry install --without dev --no-root


FROM python-base AS backend

ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=backend-build /app/.venv /app/.venv
COPY volunteers/ /app/volunteers/
COPY alembic.ini /app/

ENV UVICORN_HOST="0.0.0.0" \
    UVICORN_PORT="3000"

EXPOSE $UVICORN_PORT

CMD ["uvicorn", "volunteers.app:app"]
