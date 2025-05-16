import sys
import threading
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager

import psutil
import requests
from fastapi import FastAPI, Request, Response
from fastapi.responses import FileResponse
from loguru import logger
from prometheus_client import Counter, make_asgi_app

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

metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status_code"]
)


@app.middleware("http")
async def track_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    HTTP_REQUESTS_TOTAL.labels(
        method=request.method, endpoint=request.url.path, status_code=response.status_code
    ).inc()
    return response


@app.get("/")
async def auth() -> FileResponse:
    return FileResponse("./volunteers/auth.html")


def send_telegram_alert(message: str) -> None:
    config = container.config()
    url = f"https://api.telegram.org/bot{config.telegram.alert_token}/sendMessage"
    payload = {"chat_id": config.telegram.chat_id, "text": message}
    requests.post(url, json=payload, timeout=3)
    logger.info(f"Sent alert: {message}")


def check_cpu() -> None:
    threading.Timer(60.0, check_cpu).start()
    cpu = psutil.cpu_percent()
    if cpu > 90:
        send_telegram_alert(f"High CPU: {cpu}%")


check_cpu()
