from contextlib import asynccontextmanager
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from volunteers.models import User
from volunteers.schemas.user import UserIn
from volunteers.services.user import UserService


@pytest.fixture
def mock_db() -> MagicMock:
    return MagicMock()


@pytest.fixture
def user_service(mock_db: MagicMock) -> UserService:
    return UserService(db=mock_db)


def make_async_cm(mock_session: Any) -> Any:
    @asynccontextmanager
    async def cm() -> Any:
        yield mock_session

    return cm()


@pytest.mark.asyncio
async def test_get_user_by_telegram_id_found(user_service: UserService) -> None:
    dummy_user: User = User(
        id=1,
        telegram_id=123456,
        first_name_ru="Имя",
        last_name_ru="Фамилия",
        full_name_en="Name Lastname",
        isu_id=42,
        patronymic_ru="Отчество",
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
        full_name_en="Denis Potekhin",
        isu_id=312656,
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
        mock_session.add.assert_called_once_with(result)
        mock_session.commit.assert_awaited_once()
