from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.position.router import router
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
    container.year_service.override(year_service)  # <-- FIX: assign mock, not lambda
    container.wire(modules=["volunteers.api.v1.admin.position.router"])
    app = AppWithContainer()
    app.container = container
    app.test_year_service = year_service
    app.include_router(router, prefix="/app/v1/admin/position")
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
def add_position_request() -> dict[str, Any]:
    return {
        "year_id": 42,
        "name": "Test Position",
        "can_desire": False,
        "has_halls": False,
        "is_manager": False,
        "score": 1.0,
        "description": None,
    }


@pytest.fixture
def edit_position_request() -> dict[str, Any]:
    return {
        "name": "Updated Position",
    }


@pytest.fixture(autouse=True)
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    async def _override_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = _override_with_admin
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_add_position_success(
    app: AppWithContainer, add_position_request: dict[str, Any]
) -> None:
    class FakePosition:
        id = 101
        name = "Test Position"

    fake_position = FakePosition()
    app.test_year_service.add_position = AsyncMock(return_value=fake_position)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/app/v1/admin/position/add", json=add_position_request)

    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "position_id" in data
    assert data["position_id"] == 101


@pytest.mark.asyncio
async def test_add_position_calls_service(
    app: AppWithContainer, add_position_request: dict[str, Any]
) -> None:
    fake_position = MagicMock(id=202, name="Another Position")
    add_position_mock = AsyncMock(return_value=fake_position)
    app.test_year_service.add_position = add_position_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/app/v1/admin/position/add", json=add_position_request)

    add_position_mock.assert_awaited_once()
    args, kwargs = add_position_mock.call_args
    position_in = kwargs.get("position_in") or args[0]
    assert position_in.year_id == 42
    assert position_in.name == "Test Position"


@pytest.mark.asyncio
async def test_edit_position_success(
    app: AppWithContainer, edit_position_request: dict[str, Any]
) -> None:
    edit_position_mock = AsyncMock()
    app.test_year_service.edit_position_by_position_id = edit_position_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/app/v1/admin/position/999/edit", json=edit_position_request)

    assert resp.status_code == status.HTTP_200_OK
    edit_position_mock.assert_awaited_once()
    args, kwargs = edit_position_mock.call_args
    assert kwargs.get("position_id") == 999
    position_edit_in = kwargs.get("position_edit_in")
    assert position_edit_in.name == "Updated Position"
