from collections.abc import Callable
from typing import TYPE_CHECKING, Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.auth import router as auth_router
from volunteers.auth.jwt_tokens import JWTTokenPayload
from volunteers.core.di import Container
from volunteers.models import User

if TYPE_CHECKING:
    from dependency_injector.containers import DeclarativeContainer


class FastAPIWithContainer(FastAPI):
    if TYPE_CHECKING:
        container: "DeclarativeContainer"


class WithUserDependencyNotFoundError(RuntimeError):
    """Raised when the with_user dependency cannot be found in the router."""

    def __init__(self) -> None:
        super().__init__("with_user dependency not found")


@pytest.fixture
def test_user() -> User:
    return User(
        id=123,
        telegram_id=123456,
        first_name_ru="Денис",
        last_name_ru="Потехин",
        patronymic_ru="Александрович",
        first_name_en="Denis",
        last_name_en="Potekhin",
        is_admin=False,
        isu_id=312656,
    )


@pytest.fixture
def config() -> MagicMock:
    class Jwt:
        expiration: int = 3600
        refresh_expiration: int = 7200

    class Telegram:
        token: str = "dummy-token-for-tests"  # noqa: S105
        expiration_time: int = 60

    cfg: MagicMock = MagicMock()
    cfg.jwt = Jwt()
    cfg.telegram = Telegram()
    return cfg


@pytest.fixture
def registration_request() -> dict[str, Any]:
    return {
        "telegram_id": 123456,
        "telegram_auth_date": 11111111,
        "telegram_first_name": "Денис",
        "telegram_hash": "hash",
        "telegram_last_name": "Потехин",
        "telegram_username": "denispotexin",
        "telegram_photo_url": "http://example.com/photo.jpg",
        "first_name_ru": "Денис",
        "last_name_ru": "Потехин",
        "first_name_en": "Denis",
        "last_name_en": "Potekhin",
        "isu_id": 313656,
        "patronymic_ru": "Александрович",
    }


@pytest.fixture
def telegram_login_request() -> dict[str, Any]:
    return {
        "telegram_id": 123456,
        "telegram_auth_date": 11111111,
        "telegram_first_name": "Денис",
        "telegram_hash": "hash",
        "telegram_last_name": "Потехин",
        "telegram_username": "denispotexin",
        "telegram_photo_url": "http://example.com/photo.jpg",
    }


@pytest.fixture
def refresh_token_request() -> dict[str, Any]:
    return {"refresh_token": "refresh.token"}


@pytest.fixture
def app(config: MagicMock, test_user: User) -> FastAPIWithContainer:
    container: Container = Container()
    user_service: MagicMock = MagicMock()
    user_service.get_user_by_telegram_id = AsyncMock(return_value=None)
    user_service.create_user = AsyncMock(return_value=test_user)
    user_service.update_user = AsyncMock(return_value=None)
    container.user_service.override(user_service)
    container.config.override(config)
    container.wire(modules=[auth_router])
    app: FastAPIWithContainer = FastAPIWithContainer()
    app.container = container
    app.include_router(auth_router.router, prefix="/api/v1/auth")
    return app


@pytest.fixture(autouse=True)
def patch_jwt_and_telegram(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_router, "verify_telegram_login", lambda data, config: True)
    monkeypatch.setattr(auth_router, "create_refresh_token", AsyncMock(return_value="refresh"))
    monkeypatch.setattr(auth_router, "create_access_token", AsyncMock(return_value="access"))
    monkeypatch.setattr(
        auth_router,
        "verify_refresh_token",
        AsyncMock(return_value=JWTTokenPayload(user_id=123, role="user")),
    )


@pytest.mark.asyncio
async def test_register_success(
    app: FastAPIWithContainer, registration_request: dict[str, Any], config: MagicMock
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/register", json=registration_request)
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["token"] == "access"  # noqa: S105
    assert data["refresh_token"] == "refresh"  # noqa: S105
    assert data["expires_in"] == config.jwt.expiration
    assert data["refresh_expires_in"] == config.jwt.refresh_expiration


@pytest.mark.asyncio
async def test_register_duplicate(
    app: FastAPIWithContainer, registration_request: dict[str, Any]
) -> None:
    app.container.user_service().get_user_by_telegram_id = AsyncMock(return_value=object())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/register", json=registration_request)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_invalid_telegram(
    monkeypatch: pytest.MonkeyPatch, app: FastAPIWithContainer, registration_request: dict[str, Any]
) -> None:
    monkeypatch.setattr(auth_router, "verify_telegram_login", lambda data, config: False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/register", json=registration_request)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_success(
    app: FastAPIWithContainer, telegram_login_request: dict[str, Any]
) -> None:
    app.container.user_service().get_user_by_telegram_id = AsyncMock(
        return_value=type(
            "User",
            (),
            {"id": 123, "telegram_username": telegram_login_request["telegram_username"]},
        )()
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/login", json=telegram_login_request)
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["token"] == "access"  # noqa: S105
    assert data["refresh_token"] == "refresh"  # noqa: S105


@pytest.mark.asyncio
async def test_login_invalid_telegram(
    monkeypatch: pytest.MonkeyPatch,
    app: FastAPIWithContainer,
    telegram_login_request: dict[str, Any],
) -> None:
    monkeypatch.setattr(auth_router, "verify_telegram_login", lambda data, config: False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/login", json=telegram_login_request)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_user_not_found(
    app: FastAPIWithContainer, telegram_login_request: dict[str, Any]
) -> None:
    app.container.user_service().get_user_by_telegram_id = AsyncMock(return_value=None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/telegram/login", json=telegram_login_request)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_refresh_success(
    app: FastAPIWithContainer, refresh_token_request: dict[str, Any], config: MagicMock
) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/auth/refresh", json=refresh_token_request)
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["token"] == "access"  # noqa: S105
    assert data["refresh_token"] == refresh_token_request["refresh_token"]
    assert data["expires_in"] == config.jwt.expiration
    assert data["refresh_expires_in"] == config.jwt.refresh_expiration


def get_with_user_dep() -> Callable[[], User]:
    for route in auth_router.router.routes:
        if getattr(route, "path", None) == "/me":
            dependant = getattr(route, "dependant", None)
            dependencies = getattr(dependant, "dependencies", None)
            if dependencies is not None:
                for dep in dependencies:
                    if getattr(dep.call, "__name__", None) == "with_user":
                        return cast(Callable[[], User], dep.call)
    raise WithUserDependencyNotFoundError()


@pytest.mark.asyncio
async def test_me_success(app: FastAPIWithContainer, test_user: User) -> None:
    async def with_user_dep() -> User:
        return test_user

    app.dependency_overrides[get_with_user_dep()] = with_user_dep
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["user_id"] == test_user.id
    assert data["first_name_ru"] == test_user.first_name_ru
    assert data["last_name_ru"] == test_user.last_name_ru
    assert data["first_name_en"] == test_user.first_name_en
    assert data["last_name_en"] == test_user.last_name_en
    assert data["is_admin"] == test_user.is_admin
    assert data["isu_id"] == test_user.isu_id
    assert data["patronymic_ru"] == test_user.patronymic_ru
