from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.day.router import router
from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User


class AppWithContainer(FastAPI):
    container: Container
    test_year_service: MagicMock  # for direct access in tests


@pytest.fixture
def app() -> AppWithContainer:
    container = Container()
    year_service = MagicMock()
    container.year_service.override(year_service)  # FIX: assign mock, not lambda
    container.wire(modules=["volunteers.api.v1.admin.day.router"])
    app = AppWithContainer()
    app.container = container
    app.test_year_service = year_service
    app.include_router(router, prefix="/api/v1/admin/day")
    return app


@pytest.fixture
def admin_user() -> User:
    return User(
        id=1,
        telegram_id=111,
        first_name_ru="Админ",
        last_name_ru="Тестов",
        patronymic_ru="Тестович",
        first_name_en="Admin",
        last_name_en="Testov",
        is_admin=True,
        isu_id=1111,
    )


@pytest.fixture
def add_day_request() -> dict[str, Any]:
    return {
        "year_id": 42,
        "name": "Test Day",
        "information": "Day info",
        "score": 10.0,
        "mandatory": True,
        "assignment_published": False,
    }


@pytest.fixture
def edit_day_request() -> dict[str, Any]:
    return {
        "name": "Updated Day",
        "information": "Updated info",
    }


@pytest.fixture(autouse=True)
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    async def _override_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = _override_with_admin
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_add_day_success(app: AppWithContainer, add_day_request: dict[str, Any]) -> None:
    class FakeDay:
        id = 101
        name = "Test Day"

    fake_day = FakeDay()
    app.test_year_service.add_day = AsyncMock(return_value=fake_day)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/day/add", json=add_day_request)

    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "day_id" in data
    assert data["day_id"] == 101


@pytest.mark.asyncio
async def test_add_day_calls_service(
    app: AppWithContainer, add_day_request: dict[str, Any]
) -> None:
    fake_day = MagicMock(id=202, name="Another Day")
    add_day_mock = AsyncMock(return_value=fake_day)
    app.test_year_service.add_day = add_day_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/v1/admin/day/add", json=add_day_request)

    add_day_mock.assert_awaited_once()
    args, kwargs = add_day_mock.call_args
    day_in = kwargs.get("day_in") or args[0]
    assert day_in.year_id == 42
    assert day_in.name == "Test Day"
    assert day_in.information == "Day info"


@pytest.mark.asyncio
async def test_edit_day_success(app: AppWithContainer, edit_day_request: dict[str, Any]) -> None:
    edit_day_mock = AsyncMock()
    app.test_year_service.edit_day_by_day_id = edit_day_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/day/999/edit", json=edit_day_request)

    assert resp.status_code == status.HTTP_200_OK
    edit_day_mock.assert_awaited_once()
    args, kwargs = edit_day_mock.call_args
    # The service should be called with day_id=999 and the correct edit data
    assert kwargs.get("day_id") == 999
    day_edit_in = kwargs.get("day_edit_in")
    assert day_edit_in.name == "Updated Day"
    assert day_edit_in.information == "Updated info"
