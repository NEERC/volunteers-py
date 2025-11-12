from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

import loguru
from dependency_injector.wiring import Provide
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker


class BaseService:
    db: Annotated[AsyncEngine, Provide["db"]]

    def __init__(self) -> None:
        self.logger = loguru.logger.bind(service=self.__class__.__name__)

    @asynccontextmanager
    async def session_scope(self) -> AsyncGenerator[AsyncSession]:
        async_session = async_sessionmaker(self.db, expire_on_commit=False)
        async with async_session() as session:
            yield session
