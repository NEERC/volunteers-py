from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import loguru
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker


class BaseService:
    def __init__(self, db: AsyncEngine) -> None:
        self.logger = loguru.logger.bind(service=self.__class__.__name__)
        self.db = db

    @asynccontextmanager
    async def session_scope(self) -> AsyncGenerator[AsyncSession]:
        async_session = async_sessionmaker(self.db, expire_on_commit=False)
        async with async_session() as session:
            yield session
