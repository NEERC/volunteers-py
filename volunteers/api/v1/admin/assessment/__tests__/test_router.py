from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.assessment.router import router
from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User


class AppWithContainer(FastAPI):
    container: Container
    test_year_service: MagicMock  # Add this attribute for type checking


@pytest.fixture
def app() -> AppWithContainer:
    container = Container()
    year_service = MagicMock()
    container.year_service.override(year_service)  # FIX: assign mock, not lambda
    container.wire(modules=["volunteers.api.v1.admin.assessment.router"])
    app = AppWithContainer()
    app.container = container
    app.test_year_service = year_service  # Set attribute for tests
    app.include_router(router, prefix="/api/v1/admin/assessment")
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
def add_assessment_request() -> dict[str, Any]:
    return {
        "user_day_id": 123,
        "comment": "Test assessment",
        "value": 5,
    }


@pytest.fixture
def edit_assessment_request() -> dict[str, Any]:
    return {
        "comment": "Updated comment",
        "value": 4,
    }


@pytest.fixture(autouse=True)
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    async def _override_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = _override_with_admin
    yield
    app.dependency_overrides = {}


@pytest.mark.asyncio
async def test_add_assessment_success(
    app: AppWithContainer, add_assessment_request: dict[str, Any]
) -> None:
    class FakeAssessment:
        id = 456

    app.test_year_service.add_assessment = AsyncMock(return_value=FakeAssessment())

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/assessment/add", json=add_assessment_request)

    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "assessment_id" in data
    assert data["assessment_id"] == 456


@pytest.mark.asyncio
async def test_add_assessment_calls_service(
    app: AppWithContainer, add_assessment_request: dict[str, Any]
) -> None:
    fake_assessment = MagicMock(id=789)
    add_assessment_mock = AsyncMock(return_value=fake_assessment)
    app.test_year_service.add_assessment = add_assessment_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/v1/admin/assessment/add", json=add_assessment_request)

    add_assessment_mock.assert_awaited_once()
    args, kwargs = add_assessment_mock.call_args
    assessment_in = kwargs.get("assessment_in") or args[0]
    assert assessment_in.user_day_id == 123
    assert assessment_in.comment == "Test assessment"
    assert assessment_in.value == 5


@pytest.mark.asyncio
async def test_edit_assessment_success(
    app: AppWithContainer, edit_assessment_request: dict[str, Any]
) -> None:
    edit_assessment_mock = AsyncMock()
    app.test_year_service.edit_assessment_by_assessment_id = edit_assessment_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/admin/assessment/999/edit", json=edit_assessment_request)

    assert resp.status_code == status.HTTP_200_OK
    edit_assessment_mock.assert_awaited_once()
    args, kwargs = edit_assessment_mock.call_args
    assert kwargs.get("assessment_id") == 999
    assessment_edit_in = kwargs.get("assessment_edit_in") or args[1]
    assert assessment_edit_in.comment == "Updated comment"
    assert assessment_edit_in.value == 4
