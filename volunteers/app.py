import sys
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from prometheus_client import Counter, make_asgi_app

from volunteers.api.router import router as api_router
from volunteers.core.di import container
from volunteers.core.socketio import sio, socket_app
from volunteers.sockets.assignments import register_assignment_handlers

logger.remove()
logger.add(sys.stdout, level="DEBUG")

# Wire the container with the necessary packages
container.wire(
    modules=[__name__, "volunteers.api.v1.admin.assessment.router"],
    packages=[
        "volunteers.services",
        "volunteers.models",
        "volunteers.schemas",
        "volunteers.core",
        "volunteers.auth",
        "volunteers.api",
        "volunteers.bot",
    ],
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Startup
    init_resources = container.init_resources()
    if init_resources:
        await init_resources
    # parse config
    c = container.config()
    logger.debug(f"Config: {c}")

    # Register WebSocket handlers
    await register_assignment_handlers(sio)
    logger.info("WebSocket handlers registered")

    yield
    # Shutdown
    shutdown_resources = container.shutdown_resources()
    if shutdown_resources:
        await shutdown_resources


app = FastAPI(lifespan=lifespan, openapi_url="/api/v1/openapi.json", docs_url="/api/v1/docs")

app.include_router(api_router)

# Mount Socket.IO app at /socket.io
app.mount("/socket.io", socket_app)

# Serve static files for certificates
app.mount("/static", StaticFiles(directory="volunteers/static"), name="static")

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
