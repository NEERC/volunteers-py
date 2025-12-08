from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from volunteers.models import User
from volunteers.models.gender import Gender
from volunteers.schemas.user import UserIn
from volunteers.services.user import UserService


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


@pytest.fixture
def user_service(mock_db: MagicMock) -> UserService:
    service = UserService()
    service.db = mock_db
    return service


def make_async_cm(mock_session: Any) -> Any:
    @asynccontextmanager
    async def cm() -> AsyncGenerator[Any]:
        yield mock_session

    return cm()


@pytest.mark.asyncio
async def test_get_user_by_telegram_id_found(user_service: UserService) -> None:
    dummy_user: User = User(
        id=1,
        telegram_id=123456,
        first_name_ru="Имя",
        last_name_ru="Фамилия",
        first_name_en="Name",
        last_name_en="Lastname",
        isu_id=42,
        patronymic_ru="Отчество",
        phone="+1234567890",
        email="test@example.com",
        telegram_username="testuser",
        gender=Gender.MALE,
        is_admin=False,
    )
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = dummy_user

    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch.object(user_service, "session_scope", return_value=make_async_cm(mock_session)):
        result: User | None = await user_service.get_user_by_telegram_id(123456)
        assert result == dummy_user


@pytest.mark.asyncio
async def test_get_user_by_telegram_id_not_found(user_service: UserService) -> None:
    mock_result: MagicMock = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session: MagicMock = MagicMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    with patch.object(user_service, "session_scope", return_value=make_async_cm(mock_session)):
        result: User | None = await user_service.get_user_by_telegram_id(111111)
        assert result is None


@pytest.mark.asyncio
async def test_create_user(user_service: UserService) -> None:
    user_in: UserIn = UserIn(
        telegram_id=123456,
        first_name_ru="Денис",
        patronymic_ru="Александрович",
        last_name_ru="Потехин",
        first_name_en="Denis",
        last_name_en="Potekhin",
        isu_id=312656,
        phone="+1234567890",
        email="denis@example.com",
        telegram_username="denis_potekhin",
        gender=Gender.MALE,
        is_admin=True,
    )

    mock_session: MagicMock = MagicMock()
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()

    with patch.object(user_service, "session_scope", return_value=make_async_cm(mock_session)):
        result: User = await user_service.create_user(user_in)
        assert isinstance(result, User)
        assert result.telegram_id == user_in.telegram_id
        assert result.first_name_ru == user_in.first_name_ru
        assert result.is_admin == user_in.is_admin
        assert result.gender == user_in.gender
        mock_session.add.assert_called_once_with(result)
        mock_session.commit.assert_awaited_once()
