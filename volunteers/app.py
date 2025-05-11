import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from loguru import logger

from volunteers.api.router import router as api_router
from volunteers.core.di import Container

logger.remove()
logger.add(sys.stdout, level="DEBUG")

container = Container()
container.wire(packages=["volunteers"])


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Startup
    init_resources = container.init_resources()
    if init_resources:
        await init_resources
    # parse config
    c = container.config()
    logger.info(f"Config: {c}")
    yield
    # Shutdown
    shutdown_resources = container.shutdown_resources()
    if shutdown_resources:
        await shutdown_resources


app = FastAPI(lifespan=lifespan)

app.include_router(api_router)


@app.get("/")
async def auth() -> FileResponse:
    return FileResponse("./volunteers/auth.html")
