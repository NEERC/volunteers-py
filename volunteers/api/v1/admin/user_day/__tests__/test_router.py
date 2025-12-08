from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.user_day.router import router
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
    container.wire(modules=["volunteers.api.v1.admin.user_day.router"])
    app = AppWithContainer()
    app.container = container
    app.test_year_service = year_service
    app.include_router(router, prefix="/api/v1/admin/user_day")
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
def add_user_day_request() -> dict[str, Any]:
    # Attendance must be one of: 'yes', 'no', 'late', 'sick', 'unknown'
    return {
        "application_form_id": 42,
        "day_id": 77,
        "information": "User attended.",
        "attendance": "yes",
        "position_id": 1,
    }


@pytest.fixture
def edit_user_day_request() -> dict[str, Any]:
    # Attendance must be one of: 'yes', 'no', 'late', 'sick', 'unknown'
    return {
        "information": "User did not attend.",
        "attendance": "no",
        "position_id": 1,
    }


@pytest.fixture(autouse=True)
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    async def _override_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = _override_with_admin
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_add_user_day_success(
    app: AppWithContainer, add_user_day_request: dict[str, Any]
) -> None:
    class FakeUserDay:
        id = 555

    fake_user_day = FakeUserDay()
    app.test_year_service.add_user_day = AsyncMock(return_value=fake_user_day)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/user_day/add", json=add_user_day_request)
    assert resp.status_code == status.HTTP_201_CREATED, resp.json()
    data = resp.json()
    assert "user_day_id" in data
    assert data["user_day_id"] == 555


@pytest.mark.asyncio
async def test_add_user_day_calls_service(
    app: AppWithContainer, add_user_day_request: dict[str, Any]
) -> None:
    from volunteers.models.attendance import Attendance

    fake_user_day = MagicMock(id=888)
    add_user_day_mock = AsyncMock(return_value=fake_user_day)
    app.test_year_service.add_user_day = add_user_day_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/user_day/add", json=add_user_day_request)
    assert resp.status_code == status.HTTP_201_CREATED, resp.json()
    add_user_day_mock.assert_awaited_once()
    args, kwargs = add_user_day_mock.call_args
    user_day_in = kwargs.get("user_day_in") or args[0]
    assert user_day_in.application_form_id == 42
    assert user_day_in.day_id == 77
    assert user_day_in.information == "User attended."
    # Attendance is always set to UNKNOWN in the router, regardless of input
    assert user_day_in.attendance == Attendance.UNKNOWN


@pytest.mark.asyncio
async def test_edit_user_day_success(
    app: AppWithContainer, edit_user_day_request: dict[str, Any]
) -> None:
    edit_user_day_mock = AsyncMock()
    app.test_year_service.edit_user_day_by_user_day_id = edit_user_day_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/user_day/123/edit", json=edit_user_day_request)
    assert resp.status_code == status.HTTP_200_OK, resp.json()
    edit_user_day_mock.assert_awaited_once()
    args, kwargs = edit_user_day_mock.call_args
    assert kwargs.get("user_day_id") == 123
    user_day_edit_in = kwargs.get("user_day_edit_in")
    assert user_day_edit_in.information == "User did not attend."
    # Attendance is always set to None in the router, as it's managed via attendance API
    assert user_day_edit_in.attendance is None
