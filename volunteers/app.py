from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from volunteers.core.di import Container


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    container = Container()
    # Startup
    init_resources = container.init_resources()
    if init_resources:
        await init_resources
    yield
    # Shutdown
    shutdown_resources = container.shutdown_resources()
    if shutdown_resources:
        await shutdown_resources


app = FastAPI(lifespan=lifespan)
