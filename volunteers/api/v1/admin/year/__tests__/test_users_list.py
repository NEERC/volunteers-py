from collections.abc import Generator
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from volunteers.api.v1.admin.year.router import router
from volunteers.core.di import Container
from volunteers.models import ApplicationForm, User
from volunteers.services.user import UserService


class AppWithContainer(FastAPI):
    container: Container
    test_user_service: MagicMock  # for direct access in tests


@pytest.fixture
def app() -> AppWithContainer:
    container = Container()
    user_service: MagicMock = MagicMock(spec=UserService)
    container.user_service.override(user_service)
    container.wire(modules=["volunteers.api.v1.admin.year.router"])
    app = AppWithContainer()
    app.container = container
    app.test_user_service = user_service
    app.include_router(router, prefix="/api/v1/admin/year")
    return app


@pytest.fixture
def admin_user() -> User:
    return User(
        id=1,
        telegram_id=123456789,
        first_name_ru="Admin",
        last_name_ru="User",
        full_name_en="Admin User",
        is_admin=True,
    )


@pytest.fixture
def override_with_admin(app: AppWithContainer, admin_user: User) -> Generator[None]:
    from volunteers.auth.deps import with_admin

    def mock_with_admin() -> User:
        return admin_user

    app.dependency_overrides[with_admin] = mock_with_admin
    yield
    app.dependency_overrides = {}


@pytest.fixture
def sample_users() -> list[User]:
    user1 = User(
        id=1,
        telegram_id=111111111,
        first_name_ru="Иван",
        last_name_ru="Иванов",
        patronymic_ru="Иванович",
        full_name_en="Ivan Ivanov",
        email="ivan@example.com",
        phone="+1234567890",
        telegram_username="ivan_user",
        is_admin=False,
    )
    user2 = User(
        id=2,
        telegram_id=222222222,
        first_name_ru="Петр",
        last_name_ru="Петров",
        patronymic_ru=None,
        full_name_en="Petr Petrov",
        email="petr@example.com",
        phone="+0987654321",
        telegram_username="petr_user",
        is_admin=False,
    )
    return [user1, user2]


@pytest.fixture
def sample_application_forms() -> list[ApplicationForm]:
    form1 = ApplicationForm(
        id=1,
        year_id=1,
        user_id=1,
        itmo_group="M3234",
        comments="",
    )
    form2 = ApplicationForm(
        id=2,
        year_id=2,
        user_id=1,
        itmo_group="M3235",
        comments="",
    )
    return [form1, form2]


async def test_get_users_list_success(
    app: AppWithContainer,
    admin_user: User,
    sample_users: list[User],
    sample_application_forms: list[ApplicationForm],
    override_with_admin: None,
) -> None:
    # Setup mock data
    for user in sample_users:
        user.application_forms = {
            form for form in sample_application_forms if form.user_id == user.id
        }

    # Mock the service method to return the expected data
    app.test_user_service.get_users_with_registration_status.return_value = [
        (sample_users[0], True, "M3234"),  # user1, registered, with group
        (sample_users[1], False, None),  # user2, not registered, no group
    ]

    client = TestClient(app)
    response = client.get("/api/v1/admin/year/1/users")

    assert response.status_code == 200
    data = response.json()
    assert "users" in data
    assert len(data["users"]) == 2

    # Check first user (registered)
    user1_data = data["users"][0]
    assert user1_data["id"] == 1
    assert user1_data["first_name_ru"] == "Иван"
    assert user1_data["last_name_ru"] == "Иванов"
    assert user1_data["patronymic_ru"] == "Иванович"
    assert user1_data["full_name_en"] == "Ivan Ivanov"
    assert user1_data["itmo_group"] == "M3234"
    assert user1_data["email"] == "ivan@example.com"
    assert user1_data["phone"] == "+1234567890"
    assert user1_data["telegram_username"] == "ivan_user"
    assert user1_data["is_registered"] is True

    # Check second user (not registered for year 1)
    user2_data = data["users"][1]
    assert user2_data["id"] == 2
    assert user2_data["first_name_ru"] == "Петр"
    assert user2_data["last_name_ru"] == "Петров"
    assert user2_data["patronymic_ru"] is None
    assert user2_data["full_name_en"] == "Petr Petrov"
    assert user2_data["itmo_group"] is None
    assert user2_data["email"] == "petr@example.com"
    assert user2_data["phone"] == "+0987654321"
    assert user2_data["telegram_username"] == "petr_user"
    assert user2_data["is_registered"] is False
