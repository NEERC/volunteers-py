from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from volunteers.models import ApplicationForm, Day, Position, Year
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.services.year import ApplicationFormNotFound, YearService


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


@pytest.fixture
def year_service(mock_db: MagicMock) -> YearService:
    return YearService(db=mock_db)


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
        positions: set[Position] = await year_service.get_positions_by_year_id(4)
        assert positions == set(dummy_positions)


@pytest.mark.asyncio
async def test_get_days_by_year_id(year_service: YearService) -> None:
    dummy_days: list[Day] = [Day(id=1), Day(id=2)]
    mock_result: MagicMock = MagicMock()
    mock_result.scalars.return_value.all.return_value = dummy_days
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    with patch.object(year_service, "session_scope", return_value=make_async_cm(mock_session)):
        days: set[Day] = await year_service.get_days_by_year_id(3)
        assert days == set(dummy_days)


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
        year_id=1, user_id=2, itmo_group="A", comments="test", desired_positions_ids=[7, 9]
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
        year_id=1, user_id=2, itmo_group="G2", comments="updated", desired_positions_ids=[4, 5]
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
        year_id=1, user_id=2, itmo_group="G2", comments="updated", desired_positions_ids=[4, 5]
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
