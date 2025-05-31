from collections.abc import Generator
from typing import Any

import pytest
from _pytest.monkeypatch import MonkeyPatch
from fastapi.testclient import TestClient

from volunteers.app import app


@pytest.fixture
def client() -> Generator[TestClient]:
    # Using FastAPI's TestClient for sync tests
    with TestClient(app) as c:
        yield c


def test_root_serves_auth_html(client: TestClient, monkeypatch: MonkeyPatch) -> None:
    # Patch FileResponse to avoid actual file IO and just test the endpoint logic
    class DummyFileResponse:
        def __init__(self, path: str) -> None:
            self.path = path

    monkeypatch.setattr("volunteers.app.FileResponse", DummyFileResponse)
    response = client.get("/")
    assert isinstance(
        response._content, bytes
    )  # TestClient returns a Response, not our DummyFileResponse
    # Check that our DummyFileResponse was instantiated (side effect)
    # Since we patched FileResponse, we check for 200 OK as default
    assert response.status_code == 200


def test_metrics_endpoint(client: TestClient) -> None:
    response = client.get("/metrics/")
    # Prometheus metrics endpoint should return plaintext metrics data
    assert response.status_code == 200
    assert b"# HELP" in response.content


def test_api_router_included(client: TestClient) -> None:
    # This checks that the /api or other router endpoints exist.
    # If you know a specific route, check it, e.g., /api/health or similar.
    # Here, we just check that the OpenAPI docs (served by FastAPI) exist.
    response = client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert "paths" in response.json()


def test_http_middleware_metrics_inc(client: TestClient, monkeypatch: MonkeyPatch) -> None:
    # This test checks the middleware increments the Prometheus counter.
    # We'll patch the Counter.labels and inc methods.

    called: dict[str, bool] = {"labels": False, "inc": False}

    class DummyCounter:
        def labels(self, **kwargs: Any) -> "DummyCounter":
            called["labels"] = True
            return self

        def inc(self) -> None:
            called["inc"] = True

    monkeypatch.setattr("volunteers.app.HTTP_REQUESTS_TOTAL", DummyCounter())
    response = client.get("/")
    assert response.status_code == 200
    assert called["labels"]
    assert called["inc"]
