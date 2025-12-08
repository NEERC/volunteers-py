from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from volunteers.models import ApplicationForm, Assessment, Day, Position, UserDay, Year
from volunteers.models.attendance import Attendance
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.schemas.day import DayEditIn, DayIn
from volunteers.schemas.position import PositionEditIn, PositionIn
from volunteers.schemas.user_day import UserDayEditIn
from volunteers.schemas.year import YearEditIn, YearIn
from volunteers.services.year import (
    ApplicationFormNotFound,
    AssessmentNotFound,
    DayNotFound,
    PositionNotFound,
    UserDayNotFound,
    YearNotFound,
    YearService,
)


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


@pytest.fixture
def year_service(mock_db: MagicMock) -> YearService:
    mock_notifier = MagicMock()
    mock_socketio = MagicMock()
    mock_socketio.emit = AsyncMock()
    service = YearService(notifier=mock_notifier, socketio_server=mock_socketio)
    service.db = mock_db
    return service


def make_async_cm(mock_session: Any) -> AbstractAsyncContextManager[Any]:
    @asynccontextmanager
    async def cm() -> Any:
        yield mock_session

    return cm()


@pytest.mark.asyncio
async def test_get_years(year_service: YearService) -> None:
    dummy_years: list[Year] = [Year(id=1), Year(id=2)]
    mock_result: MagicMock = MagicMock()
    mock_result.scalars.return_value.all.return_value = dummy_years
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        years: list[Year] = await year_service.get_years()
        assert years == dummy_years


@pytest.mark.asyncio
async def test_get_year_by_year_id(year_service: YearService) -> None:
    dummy_year: Year = Year(id=5)
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_year
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        year: Year | None = await year_service.get_year_by_year_id(5)
        assert year == dummy_year


@pytest.mark.asyncio
async def test_get_positions_by_year_id(year_service: YearService) -> None:
    dummy_positions: list[Position] = [Position(id=1), Position(id=2)]
    mock_result: MagicMock = MagicMock()
    mock_result.scalars.return_value.all.return_value = dummy_positions
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        positions: list[Position] = await year_service.get_positions_by_year_id(4)
        assert positions == dummy_positions


@pytest.mark.asyncio
async def test_get_days_by_year_id(year_service: YearService) -> None:
    dummy_days: list[Day] = [Day(id=1), Day(id=2)]
    mock_result: MagicMock = MagicMock()
    mock_result.scalars.return_value.all.return_value = dummy_days
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        days: list[Day] = await year_service.get_days_by_year_id(3)
        assert days == dummy_days


@pytest.mark.asyncio
async def test_get_form_by_year_id_and_user_id(year_service: YearService) -> None:
    dummy_form: ApplicationForm = ApplicationForm(id=1)
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_form
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        form: ApplicationForm | None = await year_service.get_form_by_year_id_and_user_id(2, 3)
        assert form == dummy_form


@pytest.mark.asyncio
async def test_create_form(year_service: YearService) -> None:
    form_data: ApplicationFormIn = ApplicationFormIn(
        year_id=1, user_id=2, itmo_group="A", comments="test", desired_positions_ids={7, 9}
    )
    mock_session: MagicMock = MagicMock()
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.create_form(form_data)
        assert mock_session.add.call_count == 1 + len(form_data.desired_positions_ids)
        mock_session.flush.assert_awaited_once()
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_form_success(year_service: YearService) -> None:
    form_data: ApplicationFormIn = ApplicationFormIn(
        year_id=1, user_id=2, itmo_group="G2", comments="updated", desired_positions_ids={4, 5}
    )
    dummy_form: ApplicationForm = ApplicationForm(
        id=100, year_id=1, user_id=2, itmo_group="A", comments="old"
    )
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_form
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.add = MagicMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.update_form(form_data)
        assert dummy_form.itmo_group == form_data.itmo_group
        assert dummy_form.comments == form_data.comments
        mock_session.flush.assert_awaited_once()
        mock_session.commit.assert_awaited_once()
        assert mock_session.add.call_count == len(form_data.desired_positions_ids)


@pytest.mark.asyncio
async def test_update_form_not_found(year_service: YearService) -> None:
    form_data: ApplicationFormIn = ApplicationFormIn(
        year_id=1, user_id=2, itmo_group="G2", comments="updated", desired_positions_ids={4, 5}
    )
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(ApplicationFormNotFound),
    ):
        await year_service.update_form(form_data)


@pytest.mark.asyncio
async def test_add_year(year_service: YearService) -> None:
    year_in = YearIn(year_name="2025", open_for_registration=True)
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        year = await year_service.add_year(year_in)
        assert year.year_name == year_in.year_name
        assert year.open_for_registration == year_in.open_for_registration
        mock_session.add.assert_called_once_with(year)
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_year_by_year_id_success(year_service: YearService) -> None:
    year_edit = YearEditIn(year_name="2026", open_for_registration=False)
    dummy_year = Year(id=1, year_name="old", open_for_registration=True)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_year
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.edit_year_by_year_id(1, year_edit)
        assert dummy_year.year_name == year_edit.year_name
        assert dummy_year.open_for_registration == year_edit.open_for_registration
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_year_by_year_id_not_found(year_service: YearService) -> None:
    year_edit = YearEditIn(year_name="2027", open_for_registration=True)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(YearNotFound),
    ):
        await year_service.edit_year_by_year_id(99, year_edit)


@pytest.mark.asyncio
async def test_add_position(year_service: YearService) -> None:
    position_in = PositionIn(
        year_id=1, name="Engineer", can_desire=True, has_halls=True, is_manager=False
    )
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        position = await year_service.add_position(position_in)
        assert position.year_id == position_in.year_id
        assert position.name == position_in.name
        mock_session.add.assert_called_once_with(position)
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_position_by_position_id_success(year_service: YearService) -> None:
    position_edit = PositionEditIn(
        name="Manager", can_desire=False, has_halls=True, is_manager=False
    )
    dummy_position = Position(
        id=1, year_id=1, name="OldName", can_desire=True, has_halls=False, is_manager=False
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_position
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.edit_position_by_position_id(1, position_edit)
        assert dummy_position.name == position_edit.name
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_position_by_position_id_not_found(year_service: YearService) -> None:
    position_edit = PositionEditIn(
        name="Manager", can_desire=False, has_halls=True, is_manager=False
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(PositionNotFound),
    ):
        await year_service.edit_position_by_position_id(99, position_edit)


@pytest.mark.asyncio
async def test_add_day(year_service: YearService) -> None:
    day_in = DayIn(
        year_id=1,
        name="Monday",
        information="Info",
        score=10.0,
        mandatory=True,
        assignment_published=True,
    )
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        day = await year_service.add_day(day_in)
        assert day.year_id == day_in.year_id
        assert day.name == day_in.name
        assert day.information == day_in.information
        assert day.score == day_in.score
        assert day.mandatory == day_in.mandatory
        mock_session.add.assert_called_once_with(day)
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_day_by_day_id_success(year_service: YearService) -> None:
    day_edit = DayEditIn(
        name="Tuesday",
        information="Updated info",
        score=15.0,
        mandatory=False,
        assignment_published=True,
    )
    dummy_day = Day(id=1, name="OldDay", information="Old info")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_day
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.edit_day_by_day_id(1, day_edit)
        assert dummy_day.name == day_edit.name
        assert dummy_day.information == day_edit.information
        assert dummy_day.score == day_edit.score
        assert dummy_day.mandatory == day_edit.mandatory
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_day_by_day_id_not_found(year_service: YearService) -> None:
    day_edit = DayEditIn(
        name="Wednesday",
        information="missing",
        score=5.0,
        mandatory=True,
        assignment_published=True,
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(DayNotFound),
    ):
        await year_service.edit_day_by_day_id(99, day_edit)


@pytest.mark.asyncio
async def test_add_user_day(year_service: YearService) -> None:
    from volunteers.models import UserDay
    from volunteers.schemas.user_day import UserDayIn

    mock_author = MagicMock()
    mock_author.telegram_username = "test_user"

    # Create UserDayIn input
    user_day_in = UserDayIn(
        application_form_id=1,
        day_id=2,
        information="info",
        attendance=Attendance.YES,
        position_id=1,
        hall_id=1,
    )

    # Create mocks for awaitable attributes
    mock_day = MagicMock(id=2)
    mock_day.name = "Test Day"
    mock_position = MagicMock(id=1)
    mock_position.name = "Test Position"
    mock_hall = MagicMock(id=1)
    mock_hall.name = "Test Hall"
    mock_application_form = MagicMock(id=1)
    mock_user = MagicMock(id=100, telegram_username="test_user")
    mock_user.first_name_ru = "Test"
    mock_user.last_name_ru = "User"

    # Setup application_form with awaitable user
    async def get_user():
        return mock_user

    mock_application_form_awaitable_attrs = MagicMock()
    mock_application_form_awaitable_attrs.user = get_user()
    mock_application_form.awaitable_attrs = mock_application_form_awaitable_attrs

    # Setup the user_day to have awaitable attrs
    created_user_day = MagicMock(spec=UserDay)
    created_user_day.application_form_id = 1
    created_user_day.day_id = 2
    created_user_day.information = "info"
    created_user_day.attendance = Attendance.YES
    created_user_day.position_id = 1
    created_user_day.hall_id = 1

    # Create async mock functions that return the mocked objects
    async def get_day():
        return mock_day

    async def get_application_form():
        return mock_application_form

    async def get_position():
        return mock_position

    async def get_hall():
        return mock_hall

    # Make awaitable_attrs properties call these async functions
    mock_awaitable_attrs = MagicMock()
    mock_awaitable_attrs.day = get_day()
    mock_awaitable_attrs.application_form = get_application_form()
    mock_awaitable_attrs.position = get_position()
    mock_awaitable_attrs.hall = get_hall()
    created_user_day.awaitable_attrs = mock_awaitable_attrs

    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    # Mock the notifier
    year_service.notifier.notify = AsyncMock()

    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        patch("volunteers.services.year.UserDay", return_value=created_user_day),
    ):
        user_day = await year_service.add_user_day(user_day_in, mock_author)
        assert user_day.application_form_id == user_day_in.application_form_id
        assert user_day.day_id == user_day_in.day_id
        assert user_day.information == user_day_in.information
        assert user_day.attendance == user_day_in.attendance
        mock_session.add.assert_called_once_with(created_user_day)
        mock_session.commit.assert_awaited_once()
        year_service.notifier.notify.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_user_day_by_user_day_id_success(year_service: YearService) -> None:
    from volunteers.models import User

    mock_author = User(
        id=1,
        telegram_id=123,
        first_name_ru="Test",
        last_name_ru="User",
        first_name_en="Test",
        last_name_en="User",
        telegram_username="test_user",
        is_admin=True,
        isu_id=123,
    )

    user_day_edit = UserDayEditIn(
        information="updated", attendance=Attendance.NO, position_id=1, hall_id=None
    )

    # Create mocks for awaitable attributes
    mock_day = MagicMock(id=2)
    mock_day.name = "Test Day"
    mock_position = MagicMock(id=1)
    mock_position.name = "Test Position"
    mock_hall = MagicMock(id=1)
    mock_hall.name = "Test Hall"
    mock_application_form = MagicMock(id=1)
    mock_user = MagicMock(id=100, telegram_username="test_user")
    mock_user.first_name_ru = "Test"
    mock_user.last_name_ru = "User"

    # Setup async functions for awaitable attrs
    async def get_day():
        return mock_day

    async def get_application_form():
        return mock_application_form

    async def get_position():
        return mock_position

    async def get_hall():
        return mock_hall

    async def get_user():
        return mock_user

    mock_application_form_awaitable_attrs = MagicMock()
    mock_application_form_awaitable_attrs.user = get_user()
    mock_application_form.awaitable_attrs = mock_application_form_awaitable_attrs

    # Use MagicMock for dummy_user_day to allow setting awaitable_attrs
    dummy_user_day = MagicMock(spec=UserDay)
    dummy_user_day.id = 1
    dummy_user_day.information = "old"
    dummy_user_day.attendance = Attendance.YES

    # Setup awaitable_attrs for dummy_user_day
    mock_awaitable_attrs = MagicMock()
    mock_awaitable_attrs.day = get_day()
    mock_awaitable_attrs.application_form = get_application_form()
    mock_awaitable_attrs.position = get_position()
    mock_awaitable_attrs.hall = get_hall()
    dummy_user_day.awaitable_attrs = mock_awaitable_attrs
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_user_day
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.get = AsyncMock(return_value=MagicMock())  # Mock session.get for Position/Hall
    mock_session.commit = AsyncMock()

    # Mock the notifier
    year_service.notifier.notify = AsyncMock()

    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.edit_user_day_by_user_day_id(1, user_day_edit, mock_author)
        assert dummy_user_day.information == user_day_edit.information
        assert dummy_user_day.attendance == user_day_edit.attendance
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_user_day_by_user_day_id_not_found(year_service: YearService) -> None:
    user_day_edit = UserDayEditIn(
        information="nope", attendance=Attendance.NO, position_id=1, hall_id=1
    )
    mock_author = MagicMock()
    mock_author.telegram_username = "test_user"
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(UserDayNotFound),
    ):
        await year_service.edit_user_day_by_user_day_id(99, user_day_edit, mock_author)


@pytest.mark.asyncio
async def test_add_assessment(year_service: YearService) -> None:
    assessment_in = AssessmentIn(user_day_id=1, comment="Nice", value=5.5)
    mock_session = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        assessment = await year_service.add_assessment(assessment_in)
        assert assessment.user_day_id == assessment_in.user_day_id
        assert assessment.comment == assessment_in.comment
        assert assessment.value == assessment_in.value
        mock_session.add.assert_called_once_with(assessment)
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_assessment_by_assessment_id_success(year_service: YearService) -> None:
    assessment_edit = AssessmentEditIn(comment="Updated", value=9.5)
    dummy_assessment = Assessment(id=1, comment="Old", value=5.25)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_assessment
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        await year_service.edit_assessment_by_assessment_id(1, assessment_edit)
        assert dummy_assessment.comment == assessment_edit.comment
        assert dummy_assessment.value == assessment_edit.value
        mock_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_edit_assessment_by_assessment_id_not_found(year_service: YearService) -> None:
    assessment_edit = AssessmentEditIn(comment="Missing", value=0.25)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with (
        patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)),
        pytest.raises(AssessmentNotFound),
    ):
        await year_service.edit_assessment_by_assessment_id(99, assessment_edit)
