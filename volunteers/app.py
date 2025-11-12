import sys
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from loguru import logger
from prometheus_client import Counter, make_asgi_app

from volunteers.api.router import router as api_router
from volunteers.core.di import Container

logger.remove()
logger.add(sys.stdout, level="DEBUG")

container = Container()
container.wire()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Startup
    init_resources = container.init_resources()
    if init_resources:
        await init_resources
    # parse config
    c = container.config()
    logger.debug(f"Config: {c}")
    yield
    # Shutdown
    shutdown_resources = container.shutdown_resources()
    if shutdown_resources:
        await shutdown_resources


app = FastAPI(lifespan=lifespan, openapi_url="/api/v1/openapi.json", docs_url="/api/v1/docs")

app.include_router(api_router)

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status_code"]
)


@app.get("/hc")
def health_check() -> str:
    """Simple healthcheck"""
    return "OK"


@app.middleware("http")
async def track_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    HTTP_REQUESTS_TOTAL.labels(
        method=request.method, endpoint=request.url.path, status_code=response.status_code
    ).inc()
    return response


# Proxy everything else to the frontend
@app.get("/{path:path}")
async def proxy(path: str) -> FileResponse:
    return FileResponse("./volunteers/auth.html")
