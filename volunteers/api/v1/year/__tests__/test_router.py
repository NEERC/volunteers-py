from collections.abc import Callable
from typing import TYPE_CHECKING, Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.year import router as year_router
from volunteers.core.di import Container
from volunteers.models import ApplicationForm, Day, Hall, Position, User, UserDay, Year
from volunteers.models.attendance import Attendance
from volunteers.models.gender import Gender

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
        telegram_username="denispotexin",
        gender=Gender.MALE,
    )


@pytest.fixture
def test_year() -> Year:
    return Year(id=1, year_name="2024", open_for_registration=True)


@pytest.fixture
def test_day() -> Day:
    return Day(id=1, year_id=1, name="Day 1", information="Test day", assignment_published=True)


@pytest.fixture
def test_position() -> Position:
    return Position(id=1, year_id=1, name="Test Position", can_desire=True, has_halls=True)


@pytest.fixture
def test_hall() -> Hall:
    return Hall(id=1, year_id=1, name="Test Hall", description="Test hall description")


@pytest.fixture
def test_application_form(test_user: User, test_year: Year) -> ApplicationForm:
    return ApplicationForm(
        id=1,
        year_id=test_year.id,
        user_id=test_user.id,
        user=test_user,
        itmo_group="M3238",
        comments="Test comments",
    )


@pytest.fixture
def test_user_day(
    test_application_form: ApplicationForm, test_day: Day, test_position: Position, test_hall: Hall
) -> UserDay:
    return UserDay(
        id=1,
        application_form_id=test_application_form.id,
        application_form=test_application_form,
        day_id=test_day.id,
        day=test_day,
        position_id=test_position.id,
        position=test_position,
        hall_id=test_hall.id,
        hall=test_hall,
        information="Test assignment",
        attendance=Attendance.YES,
    )


@pytest.fixture
def app(test_user: User) -> FastAPIWithContainer:
    container: Container = Container()
    year_service: MagicMock = MagicMock()

    # Mock the year service methods
    year_service.get_year_by_year_id = AsyncMock(return_value=None)
    year_service.get_day_by_id = AsyncMock(return_value=None)
    year_service.get_all_assignments_by_day_id = AsyncMock(return_value=[])

    container.year_service.override(year_service)
    container.wire(modules=[year_router])
    app: FastAPIWithContainer = FastAPIWithContainer()
    app.container = container
    app.include_router(year_router.router, prefix="/api/v1/year")
    return app


def get_with_user_dep() -> Callable[[], User]:
    for route in year_router.router.routes:
        if "/assignments" in getattr(route, "path", ""):
            dependant = getattr(route, "dependant", None)
            dependencies = getattr(dependant, "dependencies", None)
            if dependencies is not None:
                for dep in dependencies:
                    if getattr(dep.call, "__name__", None) == "with_user":
                        return cast(Callable[[], User], dep.call)
    raise WithUserDependencyNotFoundError()


@pytest.mark.asyncio
async def test_get_day_assignments_success(
    app: FastAPIWithContainer,
    test_user: User,
    test_year: Year,
    test_day: Day,
    test_user_day: UserDay,
) -> None:
    async def with_user_dep() -> User:
        return test_user

    # Setup mocks
    app.container.year_service().get_year_by_year_id = AsyncMock(return_value=test_year)
    app.container.year_service().get_day_by_id = AsyncMock(return_value=test_day)
    app.container.year_service().get_all_assignments_by_day_id = AsyncMock(
        return_value=[test_user_day]
    )

    app.dependency_overrides[get_with_user_dep()] = with_user_dep

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/year/1/days/1/assignments")

    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert "assignments" in data
    assert len(data["assignments"]) == 1

    assignment = data["assignments"][0]
    assert assignment["name"] == "Denis Potekhin"
    assert assignment["telegram"] == "denispotexin"
    assert assignment["position"] == "Test Position"
    assert assignment["hall"] == "Test Hall"
    # attendance is not included in the response (commented out in schema)


@pytest.mark.asyncio
async def test_get_day_assignments_year_not_found(
    app: FastAPIWithContainer, test_user: User
) -> None:
    async def with_user_dep() -> User:
        return test_user

    # Setup mocks - year not found
    app.container.year_service().get_year_by_year_id = AsyncMock(return_value=None)

    app.dependency_overrides[get_with_user_dep()] = with_user_dep

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/year/999/days/1/assignments")

    assert resp.status_code == 404
    data: dict[str, Any] = resp.json()
    assert data["detail"] == "Year not found"


@pytest.mark.asyncio
async def test_get_day_assignments_day_not_found(
    app: FastAPIWithContainer, test_user: User, test_year: Year
) -> None:
    async def with_user_dep() -> User:
        return test_user

    # Setup mocks - year found but day not found
    app.container.year_service().get_year_by_year_id = AsyncMock(return_value=test_year)
    app.container.year_service().get_day_by_id = AsyncMock(return_value=None)

    app.dependency_overrides[get_with_user_dep()] = with_user_dep

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/year/1/days/999/assignments")

    assert resp.status_code == 404
    data: dict[str, Any] = resp.json()
    assert data["detail"] == "Day not found"


@pytest.mark.asyncio
async def test_get_day_assignments_day_wrong_year(
    app: FastAPIWithContainer, test_user: User, test_year: Year
) -> None:
    async def with_user_dep() -> User:
        return test_user

    # Create a day that belongs to a different year
    wrong_day = Day(id=1, year_id=999, name="Wrong Day", information="Wrong day")

    # Setup mocks - year found but day belongs to different year
    app.container.year_service().get_year_by_year_id = AsyncMock(return_value=test_year)
    app.container.year_service().get_day_by_id = AsyncMock(return_value=wrong_day)

    app.dependency_overrides[get_with_user_dep()] = with_user_dep

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/year/1/days/1/assignments")

    assert resp.status_code == 404
    data: dict[str, Any] = resp.json()
    assert data["detail"] == "Day not found"


@pytest.mark.asyncio
async def test_get_day_assignments_empty_list(
    app: FastAPIWithContainer, test_user: User, test_year: Year, test_day: Day
) -> None:
    async def with_user_dep() -> User:
        return test_user

    # Setup mocks - no assignments
    app.container.year_service().get_year_by_year_id = AsyncMock(return_value=test_year)
    app.container.year_service().get_day_by_id = AsyncMock(return_value=test_day)
    app.container.year_service().get_all_assignments_by_day_id = AsyncMock(return_value=[])

    app.dependency_overrides[get_with_user_dep()] = with_user_dep

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/year/1/days/1/assignments")

    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert "assignments" in data
    assert len(data["assignments"]) == 0
