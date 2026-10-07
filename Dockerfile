ARG PYTHON_VERSION="3.13"

FROM python:${PYTHON_VERSION}-slim AS python-base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONFAULTHANDLER=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100 \
    PYSETUP_PATH="/opt/pysetup" \
    VENV_PATH="/opt/pysetup/.venv"

ENV PATH="$VENV_PATH/bin:$PATH"

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

FROM python-base AS backend-build

ARG POETRY_VERSION="2.2.1"

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_OPTIONS_ALWAYS_COPY=true \
    POETRY_CACHE_DIR="/var/cache/pypoetry" \
    POETRY_HOME="/opt/poetry" \
    POETRY_VERSION=$POETRY_VERSION

ENV PATH="$POETRY_HOME/bin:$PATH"

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
RUN curl -sSL https://install.python-poetry.org | python3 -

WORKDIR $PYSETUP_PATH
COPY pyproject.toml poetry.lock ./

RUN --mount=type=cache,id=poetry,target=$POETRY_CACHE_DIR \
    poetry install --without dev --no-root


FROM python-base AS backend

WORKDIR /app

COPY alembic.ini /app/
COPY --from=backend-build $PYSETUP_PATH $PYSETUP_PATH
COPY volunteers/ /app/volunteers/

ENV FASTAPI_ENV=production

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "-k", "uvicorn.workers.UvicornWorker", "volunteers.app:app"]
