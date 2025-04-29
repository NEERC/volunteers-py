from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine


async def create_engine(url: str) -> AsyncEngine:
    return create_async_engine(url)
