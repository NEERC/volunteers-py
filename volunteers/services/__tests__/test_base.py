from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from volunteers.services.base import BaseService


@pytest.mark.asyncio
async def test_base_service_init_sets_logger_and_db() -> None:
    mock_db = MagicMock()
    service = BaseService()
    service.db = mock_db
    assert hasattr(service, "logger")
    assert service.db == mock_db


@pytest.mark.asyncio
async def test_session_scope_yields_session() -> None:
    mock_db = MagicMock()
    mock_session = MagicMock()
    mock_async_session = AsyncMock()
    # Patch async_sessionmaker to return a callable that yields mock_session
    with patch("volunteers.services.base.async_sessionmaker") as mock_sessionmaker:
        mock_sessionmaker.return_value = lambda: mock_async_session
        mock_async_session.__aenter__.return_value = mock_session
        service = BaseService()
        service.db = mock_db
        # Actually yield our mock_session when session_scope is used
        with patch.object(service, "session_scope", wraps=service.session_scope):
            async with service.session_scope() as session:
                assert session is not None
                # session should be mock_session
                assert session == mock_session
