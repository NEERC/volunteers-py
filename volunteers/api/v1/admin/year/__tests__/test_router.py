from collections.abc import Generator
from datetime import UTC
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.admin.year.router import router
from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.models.gender import Gender


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
        first_name_en="Admin",
        last_name_en="Testov",
        gender=Gender.MALE,
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
    _, kwargs = edit_year_mock.call_args
    assert kwargs.get("year_id") == 123
    year_edit_in = kwargs.get("year_edit_in")
    assert year_edit_in.year_name == "2026-2027"
    assert year_edit_in.open_for_registration is True


@pytest.mark.asyncio
async def test_get_registration_forms_with_experience(app: AppWithContainer) -> None:
    """Test that get_registration_forms includes experience data for each user."""
    from datetime import datetime

    from volunteers.models import ApplicationForm, Position, User

    # Create mock data
    mock_user = User(
        id=1,
        telegram_id=123,
        first_name_ru="Иван",
        last_name_ru="Иванов",
        patronymic_ru="Иванович",
        first_name_en="Ivan",
        last_name_en="Ivanov",
        isu_id=12345,
        phone="+1234567890",
        email="ivan@example.com",
        telegram_username="ivan_user",
        gender=Gender.MALE,
    )
    mock_position = Position(
        id=1, year_id=1, name="Volunteer", can_desire=True, has_halls=False, is_manager=False
    )

    mock_form = ApplicationForm(
        id=1,
        year_id=1,
        user_id=1,
        itmo_group="M1234",
        comments="Test comment",
        needs_invitation=False,
        created_at=datetime(2023, 1, 1, tzinfo=UTC),
        updated_at=datetime(2023, 1, 2, tzinfo=UTC),
    )
    mock_form.user = mock_user
    mock_form.desired_positions = {mock_position}

    # Mock the service methods
    app.test_year_service.get_all_forms_by_year_id = AsyncMock(return_value=[mock_form])
    app.test_year_service.get_user_experience = AsyncMock(
        return_value=[
            {
                "year_name": "2023",
                "positions": ["Helper", "Coordinator"],
                "attendance_stats": {"yes": 5, "late": 1, "no": 0, "sick": 0, "unknown": 0},
                "assessments": ["Great work!", "Very helpful"],
            }
        ]
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/admin/year/1/registration-forms")

    assert resp.status_code == status.HTTP_200_OK, resp.json()
    data = resp.json()

    # Verify the response structure
    assert "forms" in data
    assert len(data["forms"]) == 1

    form_data = data["forms"][0]
    assert form_data["form_id"] == 1
    assert form_data["user_id"] == 1
    assert form_data["first_name_ru"] == "Иван"
    assert form_data["last_name_ru"] == "Иванов"
    assert form_data["patronymic_ru"] == "Иванович"
    assert form_data["first_name_en"] == "Ivan"
    assert form_data["last_name_en"] == "Ivanov"
    assert form_data["isu_id"] == 12345
    assert form_data["phone"] == "+1234567890"
    assert form_data["email"] == "ivan@example.com"
    assert form_data["telegram_username"] == "ivan_user"
    assert form_data["gender"] == "male"
    assert form_data["itmo_group"] == "M1234"
    assert form_data["comments"] == "Test comment"

    # Verify desired positions
    assert "desired_positions" in form_data
    assert len(form_data["desired_positions"]) == 1
    assert form_data["desired_positions"][0]["name"] == "Volunteer"

    # Verify experience data
    assert "experience" in form_data
    assert len(form_data["experience"]) == 1

    experience = form_data["experience"][0]
    assert experience["year_name"] == "2023"
    assert experience["positions"] == ["Helper", "Coordinator"]
    assert experience["attendance_stats"] == {"yes": 5, "late": 1, "no": 0, "sick": 0, "unknown": 0}
    assert experience["assessments"] == ["Great work!", "Very helpful"]

    # Verify service methods were called
    app.test_year_service.get_all_forms_by_year_id.assert_awaited_once_with(year_id=1)
    app.test_year_service.get_user_experience.assert_awaited_once_with(1)
