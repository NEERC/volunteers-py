from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from volunteers.api.v1.admin.router import router
from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.services.__tests__.test_mailing import (  # noqa: F401
    Seed,
    engine,
    expression_evaluator,
    notifier,
    seed,
    sender,
    service,
    worker,
)
from volunteers.services.i18n import I18nService
from volunteers.services.mailing import MailingService


@pytest.fixture
async def app(engine: AsyncEngine, service: MailingService) -> AsyncGenerator[FastAPI]:  # noqa: F811
    container = Container()
    container.db.override(engine)
    container.mailing_service.override(service)
    container.i18n_service.override(I18nService())
    container.wire(modules=["volunteers.api.v1.admin.print_template.router"])
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/admin")
    app.dependency_overrides[with_user] = lambda: User(is_admin=True)
    try:
        yield app
    finally:
        container.unwire()


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_template_crud(client: AsyncClient, seed: Seed) -> None:  # noqa: F811
    url = f"/api/v1/admin/print-template/year/{seed.year_id}"
    created = await client.post(url, json={"title": "Volunteer badge"})
    assert created.status_code == 200
    template = created.json()
    assert "render-each" in template["source"]
    assert "std.typ" in [asset["file_name"] for asset in template["assets"]]
    template_url = f"{url}/{template['template_id']}"
    assert (await client.get(template_url)).json() == template
    assert (await client.get(url)).json()["templates"][0]["title"] == "Volunteer badge"
    assert (
        await client.patch(template_url, json={"title": "Invitation", "source": "= Welcome"})
    ).json()["source"] == "= Welcome"
    assert (await client.delete(template_url)).status_code == 200
    assert (await client.get(template_url)).status_code == 404


@pytest.fixture
async def template_url(client: AsyncClient, seed: Seed) -> str:  # noqa: F811
    url = f"/api/v1/admin/print-template/year/{seed.year_id}"
    response = await client.post(url, json={"title": "Volunteer badge"})
    return f"{url}/{response.json()['template_id']}"


@pytest.mark.asyncio
async def test_assets(client: AsyncClient, template_url: str) -> None:
    url = f"{template_url}/assets"
    response = await client.post(
        url, files={"file": ("std.typ", b"#let helper = 42", "text/plain")}
    )
    assert response.status_code == 200
    asset_url = f"{url}/{response.json()['asset_id']}"
    assert (await client.get(asset_url)).content == b"#let helper = 42"
    assert (await client.delete(asset_url)).status_code == 409

    for name in ("../logo.svg", "main.typ", "data.json", "wrong.exe"):
        assert (await client.post(url, files={"file": (name, b"x")})).status_code == 422
    assert (
        await client.post(url, files={"file": ("large.png", b"x" * (5 * 1024**2 + 1))})
    ).status_code == 413
    for name in ("logo.png", "logo.jpg", "logo.svg", "font.ttf", "font.otf", "font.woff2"):
        response = await client.post(url, files={"file": (name, b"<html/>")})
        assert response.status_code == 422
        assert response.json()["detail"] == "Print asset content does not match its file type"
    response = await client.post(url, files={"file": ("logo.svg", b"<svg/>", "image/svg+xml")})
    assert response.status_code == 200
    assert (await client.delete(f"{url}/{response.json()['asset_id']}")).status_code == 200


@pytest.mark.asyncio
async def test_preview(client: AsyncClient, template_url: str, seed: Seed) -> None:  # noqa: F811
    url = f"{template_url}/preview"
    response = await client.post(url, json={"day_id": seed.day1_id})
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert (
        await client.post(
            url,
            json={
                "day_id": seed.day1_id,
                "excluded_form_ids": [seed.alice_form_id, seed.bob_form_id],
            },
        )
    ).status_code == 204
    response = await client.post(url, json={"day_id": seed.day1_id, "source": "#bad-variable"})
    assert response.status_code == 422
    assert "bad-variable" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generation_shares_mailing_context(
    client: AsyncClient,
    template_url: str,
    seed: Seed,  # noqa: F811
) -> None:
    context = {
        "day_id": seed.day2_id,
        "filter": {"expression": "position.name == 'Registration'"},
        "excluded_form_ids": [seed.alice_form_id],
        "assignment_mode": "all",
    }
    response = await client.post(f"{template_url}/recipients", json=context)
    assert response.status_code == 200
    (recipient,) = response.json()["recipients"]
    assert recipient["form_id"] == seed.carol_form_id
    assert recipient["position_name"] == "Registration"
    assert recipient["hall_name"] is None
    preview = await client.post(
        f"{template_url}/preview",
        json={**context, "form_id": recipient["form_id"], "user_day_id": recipient["user_day_id"]},
    )
    assert preview.status_code == 200
    assert preview.content.startswith(b"%PDF")
    source = """
#assert.eq(data.len(), 1)
#assert.eq(data.first().user.first_name_ru, "Carol")
#assert.eq(data.first().position.name, "Registration")
#assert.eq(data.first().hall, none)
#data.first().user.first_name_ru
"""
    response = await client.post(f"{template_url}/generate", json={**context, "source": source})
    assert response.status_code == 200
    assert (
        response.headers["content-disposition"]
        == f'attachment; filename="badges-{seed.day2_id}.pdf"'
    )
    assert response.content.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_non_admin_cannot_list_templates(app: FastAPI, client: AsyncClient) -> None:
    app.dependency_overrides[with_user] = lambda: User(is_admin=False)
    response = await client.get("/api/v1/admin/print-template/year/1")
    assert response.status_code == 403
