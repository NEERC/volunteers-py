from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.year.router import router
from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User


class AppWithContainer(FastAPI):
    container: Container
    test_year_service: MagicMock  # For direct access in tests


@pytest.fixture
def app() -> AppWithContainer:
    container = Container()
    year_service = MagicMock()
    container.year_service.override(year_service)  # <--- direct mock
    container.wire(modules=["volunteers.api.v1.admin.year.router"])
    app = AppWithContainer()
    app.container = container
    app.test_year_service = year_service
    app.include_router(router, prefix="/api/v1/admin/year")
    return app


@pytest.fixture
def admin_user() -> User:
    return User(
        id=1,
        telegram_id=111,
        first_name_ru="Админ",
        last_name_ru="Тестов",
        patronymic_ru="Тестович",
        full_name_en="Admin Testov",
        is_admin=True,
        isu_id=1111,
    )


@pytest.fixture
def add_year_request() -> dict[str, Any]:
    return {"year_name": "2025-2026"}


@pytest.fixture
def edit_year_request() -> dict[str, Any]:
    return {
        "year_name": "2026-2027",
        "open_for_registration": True,
    }


@pytest.fixture(autouse=True)
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    async def _override_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = _override_with_admin
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_add_year_success(app: AppWithContainer, add_year_request: dict[str, Any]) -> None:
    class FakeYear:
        id = 321

    fake_year = FakeYear()
    app.test_year_service.add_year = AsyncMock(return_value=fake_year)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/year/add", json=add_year_request)
    assert resp.status_code == status.HTTP_201_CREATED, resp.json()
    data = resp.json()
    assert "year_id" in data
    assert data["year_id"] == 321


@pytest.mark.asyncio
async def test_add_year_calls_service(
    app: AppWithContainer, add_year_request: dict[str, Any]
) -> None:
    fake_year = MagicMock(id=777)
    add_year_mock = AsyncMock(return_value=fake_year)
    app.test_year_service.add_year = add_year_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/year/add", json=add_year_request)
    assert resp.status_code == status.HTTP_201_CREATED, resp.json()
    add_year_mock.assert_awaited_once()
    args, kwargs = add_year_mock.call_args
    year_in = kwargs.get("year_in") or args[0]
    assert year_in.year_name == "2025-2026"
    assert year_in.open_for_registration is False


@pytest.mark.asyncio
async def test_edit_year_success(app: AppWithContainer, edit_year_request: dict[str, Any]) -> None:
    edit_year_mock = AsyncMock()
    app.test_year_service.edit_year_by_year_id = edit_year_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/year/123/edit", json=edit_year_request)
    assert resp.status_code == status.HTTP_200_OK, resp.json()
    edit_year_mock.assert_awaited_once()
    args, kwargs = edit_year_mock.call_args
    assert kwargs.get("year_id") == 123
    year_edit_in = kwargs.get("year_edit_in")
    assert year_edit_in.year_name == "2026-2027"
    assert year_edit_in.open_for_registration is True
