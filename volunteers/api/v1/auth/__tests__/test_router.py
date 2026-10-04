from collections.abc import Callable
from typing import TYPE_CHECKING, Any, cast
from unittest.mock import AsyncMock, MagicMock

import bcrypt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from volunteers.api.v1.auth import router as auth_router
from volunteers.auth.jwt_tokens import JWTTokenPayload
from volunteers.auth.pending import PendingAuth
from volunteers.auth.providers.keycloak import KeycloakAuthError, KeycloakUserInfo
from volunteers.core.di import Container
from volunteers.models import IdentityProvider, User, UserIdentity

if TYPE_CHECKING:
    from dependency_injector.containers import DeclarativeContainer


class FastAPIWithContainer(FastAPI):
    if TYPE_CHECKING:
        container: "DeclarativeContainer"


class WithUserDependencyNotFoundError(RuntimeError):
    """Raised when the with_user dependency cannot be found in the router."""

    def __init__(self) -> None:
        super().__init__("with_user dependency not found")


@pytest.fixture
def test_user() -> User:
    return User(
        id=123,
        first_name_ru="Денис",
        last_name_ru="Потехин",
        patronymic_ru="Александрович",
        first_name_en="Denis",
        last_name_en="Potekhin",
        is_admin=False,
        isu_id=312656,
    )


@pytest.fixture
def config() -> MagicMock:
    class Jwt:
        expiration: int = 3600
        refresh_expiration: int = 7200

    class Telegram:
        token: str = "dummy-token-for-tests"  # noqa: S105
        expiration_time: int = 60

    class Keycloak:
        issuer: str = "https://keycloak.example.com/realms/master"
        client_id: str = "volunteers"
        client_secret: str | None = None
        scope: str = "openid profile email"

    class GeoIP:
        database_path: str | None = None
        client_ip_header: str | None = "X-Real-IP"

    cfg: MagicMock = MagicMock()
    cfg.geoip = GeoIP()
    cfg.jwt = Jwt()
    cfg.telegram = Telegram()
    cfg.keycloak = Keycloak()
    return cfg


class FakeIdentityService:
    """In-memory replacement of IdentityService."""

    def __init__(self) -> None:
        self.identities: list[UserIdentity] = []
        self.users: dict[int, User] = {}

    def add_user(self, user: User, *identities: tuple[IdentityProvider, str, str | None]) -> None:
        self.users[user.id] = user
        for provider, subject, secret in identities:
            self.identities.append(
                UserIdentity(
                    id=len(self.identities) + 1,
                    user_id=user.id,
                    provider=provider,
                    subject=subject,
                    secret=secret,
                )
            )

    async def get_identity(self, provider: IdentityProvider, subject: str) -> UserIdentity | None:
        for identity in self.identities:
            if identity.provider == provider and identity.subject == subject:
                return identity
        return None

    async def get_user_by_identity(self, provider: IdentityProvider, subject: str) -> User | None:
        identity = await self.get_identity(provider, subject)
        return self.users[identity.user_id] if identity else None

    async def get_user_identities(self, user_id: int) -> list[UserIdentity]:
        return [i for i in self.identities if i.user_id == user_id]

    async def add_identity(
        self,
        user_id: int,
        provider: IdentityProvider,
        subject: str,
        display_name: str | None = None,
        secret: str | None = None,
    ) -> UserIdentity:
        identity = UserIdentity(
            id=len(self.identities) + 1,
            user_id=user_id,
            provider=provider,
            subject=subject,
            display_name=display_name,
            secret=secret,
        )
        self.identities.append(identity)
        return identity

    async def update_display_name(self, identity_id: int, display_name: str | None) -> None:
        pass


@pytest.fixture
def identity_service() -> FakeIdentityService:
    return FakeIdentityService()


@pytest.fixture
def telegram_request() -> dict[str, Any]:
    return {
        "telegram_id": 123456,
        "telegram_auth_date": 11111111,
        "telegram_first_name": "Денис",
        "telegram_hash": "hash",
        "telegram_last_name": "Потехин",
        "telegram_username": "denispotexin",
        "telegram_photo_url": "http://example.com/photo.jpg",
    }


@pytest.fixture
def keycloak_request() -> dict[str, Any]:
    return {"code": "code", "redirect_uri": "http://test/login", "code_verifier": "verifier"}


@pytest.fixture
def registration_fields() -> dict[str, Any]:
    return {
        "first_name_ru": "Денис",
        "last_name_ru": "Потехин",
        "first_name_en": "Denis",
        "last_name_en": "Potekhin",
        "isu_id": 313656,
        "patronymic_ru": "Александрович",
    }


@pytest.fixture
def refresh_token_request() -> dict[str, Any]:
    return {"refresh_token": "refresh.token"}


@pytest.fixture
def app(
    config: MagicMock, test_user: User, identity_service: FakeIdentityService
) -> FastAPIWithContainer:
    container: Container = Container()
    user_service: MagicMock = MagicMock()
    user_service.create_user = AsyncMock(return_value=test_user)
    user_service.update_user = AsyncMock(return_value=None)
    container.user_service.override(user_service)
    container.identity_service.override(identity_service)
    geoip_service = MagicMock()
    geoip_service.country_code = MagicMock(
        side_effect=lambda ip: {"77.88.8.8": "RU", "8.8.8.8": "US"}.get(ip)
    )
    container.geoip_service.override(geoip_service)
    container.config.override(config)
    container.wire(modules=[auth_router])
    app: FastAPIWithContainer = FastAPIWithContainer()
    app.container = container
    app.include_router(auth_router.router, prefix="/api/v1/auth")
    return app


@pytest.fixture(autouse=True)
def patch_jwt_and_telegram(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(auth_router, "verify_telegram_login", lambda data, config: True)
    monkeypatch.setattr(auth_router, "create_refresh_token", AsyncMock(return_value="refresh"))
    monkeypatch.setattr(auth_router, "create_access_token", AsyncMock(return_value="access"))
    monkeypatch.setattr(
        auth_router,
        "verify_refresh_token",
        AsyncMock(return_value=JWTTokenPayload(user_id=123, role="user")),
    )
    # Pending tokens are not signed in tests
    monkeypatch.setattr(auth_router, "create_pending_token", lambda p: p.model_dump_json())
    monkeypatch.setattr(
        auth_router,
        "decode_pending_token",
        lambda t: PendingAuth.model_validate_json(t) if t else PendingAuth(),
    )


@pytest.fixture(autouse=True)
def patch_keycloak(monkeypatch: pytest.MonkeyPatch) -> None:
    async def exchange(**_: Any) -> KeycloakUserInfo:
        return KeycloakUserInfo(
            sub="kc-sub",
            preferred_username="dpotekhin",
            email="denis@itmo.ru",
            given_name="Denis",
            family_name="Potekhin",
        )

    monkeypatch.setattr(auth_router, "exchange_keycloak_code", exchange)


def client(app: FastAPIWithContainer) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_keycloak_config(app: FastAPIWithContainer) -> None:
    async with client(app) as ac:
        resp = await ac.get("/api/v1/auth/keycloak/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["authorization_endpoint"] == (
        "https://keycloak.example.com/realms/master/protocol/openid-connect/auth"
    )
    assert data["client_id"] == "volunteers"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("ip", "country", "methods"),
    [
        ("77.88.8.8", "RU", ["keycloak", "legacy"]),
        ("8.8.8.8", "US", ["keycloak", "telegram", "legacy"]),
        ("10.0.0.1", None, ["keycloak", "telegram", "legacy"]),
    ],
)
async def test_country(
    app: FastAPIWithContainer, ip: str, country: str | None, methods: list[str]
) -> None:
    async with client(app) as ac:
        resp = await ac.get("/api/v1/auth/country", headers={"X-Real-IP": ip})
    assert resp.status_code == 200
    assert resp.json() == {"country_code": country, "auth_methods": methods}


@pytest.mark.asyncio
async def test_country_takes_first_forwarded_ip(app: FastAPIWithContainer) -> None:
    async with client(app) as ac:
        resp = await ac.get("/api/v1/auth/country", headers={"X-Real-IP": "77.88.8.8, 8.8.8.8"})
    assert resp.json()["country_code"] == "RU"


@pytest.mark.asyncio
async def test_telegram_invalid(
    monkeypatch: pytest.MonkeyPatch, app: FastAPIWithContainer, telegram_request: dict[str, Any]
) -> None:
    monkeypatch.setattr(auth_router, "verify_telegram_login", lambda data, config: False)
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_telegram_unknown_user_requires_keycloak(
    app: FastAPIWithContainer, telegram_request: dict[str, Any]
) -> None:
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "keycloak_required"
    assert data["user_found"] is False
    assert data["tokens"] is None
    assert data["identities"] == [{"provider": "telegram", "display_name": "@denispotexin"}]


@pytest.mark.asyncio
async def test_telegram_existing_user_without_keycloak_requires_keycloak(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    keycloak_request: dict[str, Any],
) -> None:
    identity_service.add_user(test_user, (IdentityProvider.TELEGRAM, "123456", None))
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        data = resp.json()
        assert data["status"] == "keycloak_required"
        assert data["user_found"] is True

        resp = await ac.post(
            "/api/v1/auth/keycloak",
            json={**keycloak_request, "pending_token": data["pending_token"]},
        )
    data = resp.json()
    assert data["status"] == "success"
    assert data["tokens"]["token"] == "access"  # noqa: S105
    assert data["tokens"]["refresh_token"] == "refresh"  # noqa: S105
    keycloak = await identity_service.get_identity(IdentityProvider.KEYCLOAK, "kc-sub")
    assert keycloak is not None
    assert keycloak.user_id == test_user.id


@pytest.mark.asyncio
async def test_telegram_existing_user_with_keycloak_succeeds(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
) -> None:
    identity_service.add_user(
        test_user,
        (IdentityProvider.TELEGRAM, "123456", None),
        (IdentityProvider.KEYCLOAK, "kc-sub", None),
    )
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
    data = resp.json()
    assert data["status"] == "success"
    assert data["tokens"]["token"] == "access"  # noqa: S105
    app.container.user_service().update_user.assert_awaited_once()


@pytest.mark.asyncio
async def test_keycloak_existing_user_succeeds(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    keycloak_request: dict[str, Any],
) -> None:
    identity_service.add_user(test_user, (IdentityProvider.KEYCLOAK, "kc-sub", None))
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/keycloak", json=keycloak_request)
    assert resp.json()["status"] == "success"


@pytest.mark.asyncio
async def test_keycloak_invalid(
    monkeypatch: pytest.MonkeyPatch, app: FastAPIWithContainer, keycloak_request: dict[str, Any]
) -> None:
    async def exchange(**_: Any) -> KeycloakUserInfo:
        raise KeycloakAuthError()

    monkeypatch.setattr(auth_router, "exchange_keycloak_code", exchange)
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/keycloak", json=keycloak_request)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_register_new_user(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    keycloak_request: dict[str, Any],
    registration_fields: dict[str, Any],
) -> None:
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        pending_token = resp.json()["pending_token"]
        resp = await ac.post(
            "/api/v1/auth/keycloak", json={**keycloak_request, "pending_token": pending_token}
        )
        data = resp.json()
        assert data["status"] == "registration_required"
        assert data["prefill"] == {
            "first_name": "Denis",
            "last_name": "Potekhin",
            "email": "denis@itmo.ru",
        }
        resp = await ac.post(
            "/api/v1/auth/register",
            json={**registration_fields, "pending_token": data["pending_token"]},
        )
    data = resp.json()
    assert data["status"] == "success"
    assert data["tokens"]["token"] == "access"  # noqa: S105
    user_in = app.container.user_service().create_user.await_args.args[0]
    assert user_in.telegram_username == "denispotexin"
    assert {(i.provider, i.subject) for i in identity_service.identities} == {
        (IdentityProvider.TELEGRAM, "123456"),
        (IdentityProvider.KEYCLOAK, "kc-sub"),
    }
    assert all(i.user_id == test_user.id for i in identity_service.identities)


@pytest.mark.asyncio
async def test_register_requires_keycloak(
    app: FastAPIWithContainer,
    telegram_request: dict[str, Any],
    registration_fields: dict[str, Any],
) -> None:
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        resp = await ac.post(
            "/api/v1/auth/register",
            json={**registration_fields, "pending_token": resp.json()["pending_token"]},
        )
    assert resp.status_code == 403
    app.container.user_service().create_user.assert_not_awaited()


@pytest.mark.asyncio
async def test_register_existing_user(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    registration_fields: dict[str, Any],
) -> None:
    identity_service.add_user(test_user, (IdentityProvider.TELEGRAM, "123456", None))
    pending = PendingAuth().with_identity(
        auth_router.VerifiedIdentity(provider=IdentityProvider.KEYCLOAK, subject="other-sub")
    )
    pending = pending.with_identity(
        auth_router.VerifiedIdentity(provider=IdentityProvider.TELEGRAM, subject="123456")
    )
    async with client(app) as ac:
        resp = await ac.post(
            "/api/v1/auth/register",
            json={**registration_fields, "pending_token": pending.model_dump_json()},
        )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_legacy_migration(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    keycloak_request: dict[str, Any],
) -> None:
    password_hash = bcrypt.hashpw(b"secret", bcrypt.gensalt(rounds=4)).decode()
    identity_service.add_user(
        test_user, (IdentityProvider.LEGACY, "old@example.com", password_hash)
    )
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        resp = await ac.post(
            "/api/v1/auth/legacy",
            json={
                "email": "old@example.com",
                "password": "secret",
                "pending_token": resp.json()["pending_token"],
            },
        )
        data = resp.json()
        assert data["status"] == "keycloak_required"
        assert data["user_found"] is True
        resp = await ac.post(
            "/api/v1/auth/keycloak",
            json={**keycloak_request, "pending_token": data["pending_token"]},
        )
    assert resp.json()["status"] == "success"
    linked = await identity_service.get_user_identities(test_user.id)
    assert {i.provider for i in linked} == {
        IdentityProvider.LEGACY,
        IdentityProvider.TELEGRAM,
        IdentityProvider.KEYCLOAK,
    }


@pytest.mark.asyncio
async def test_legacy_wrong_password(
    app: FastAPIWithContainer, identity_service: FakeIdentityService, test_user: User
) -> None:
    password_hash = bcrypt.hashpw(b"secret", bcrypt.gensalt(rounds=4)).decode()
    identity_service.add_user(
        test_user, (IdentityProvider.LEGACY, "old@example.com", password_hash)
    )
    async with client(app) as ac:
        resp = await ac.post(
            "/api/v1/auth/legacy", json={"email": "old@example.com", "password": "wrong"}
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_legacy_unknown(app: FastAPIWithContainer) -> None:
    async with client(app) as ac:
        resp = await ac.post(
            "/api/v1/auth/legacy", json={"email": "nobody@example.com", "password": "x"}
        )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_identities_of_different_users_conflict(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    keycloak_request: dict[str, Any],
) -> None:
    other_user = User(id=456, first_name_ru="a", last_name_ru="b", first_name_en="c")
    identity_service.add_user(test_user, (IdentityProvider.TELEGRAM, "123456", None))
    identity_service.add_user(other_user, (IdentityProvider.KEYCLOAK, "kc-sub", None))
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        resp = await ac.post(
            "/api/v1/auth/keycloak",
            json={**keycloak_request, "pending_token": resp.json()["pending_token"]},
        )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_user_with_another_keycloak_conflict(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    telegram_request: dict[str, Any],
    keycloak_request: dict[str, Any],
) -> None:
    identity_service.add_user(
        test_user,
        (IdentityProvider.TELEGRAM, "123456", None),
        (IdentityProvider.KEYCLOAK, "another-sub", None),
    )
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        assert resp.json()["status"] == "success"
        resp = await ac.post("/api/v1/auth/telegram", json=telegram_request)
        resp = await ac.post(
            "/api/v1/auth/keycloak",
            json={**keycloak_request, "pending_token": PendingAuth().model_dump_json()},
        )
        # New keycloak identity without telegram: a separate registration is offered
        assert resp.json()["status"] == "registration_required"

        pending = PendingAuth().with_identity(
            auth_router.VerifiedIdentity(provider=IdentityProvider.TELEGRAM, subject="123456")
        )
        resp = await ac.post(
            "/api/v1/auth/keycloak",
            json={**keycloak_request, "pending_token": pending.model_dump_json()},
        )
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_refresh_success(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    refresh_token_request: dict[str, Any],
    config: MagicMock,
) -> None:
    identity_service.add_user(test_user, (IdentityProvider.KEYCLOAK, "kc-sub", None))
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/refresh", json=refresh_token_request)
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["token"] == "access"  # noqa: S105
    assert data["refresh_token"] == refresh_token_request["refresh_token"]
    assert data["expires_in"] == config.jwt.expiration
    assert data["refresh_expires_in"] == config.jwt.refresh_expiration


@pytest.mark.asyncio
async def test_refresh_without_keycloak(
    app: FastAPIWithContainer,
    identity_service: FakeIdentityService,
    test_user: User,
    refresh_token_request: dict[str, Any],
) -> None:
    identity_service.add_user(test_user, (IdentityProvider.TELEGRAM, "123456", None))
    async with client(app) as ac:
        resp = await ac.post("/api/v1/auth/refresh", json=refresh_token_request)
    assert resp.status_code == 401


def get_with_user_dep() -> Callable[[], User]:
    for route in auth_router.router.routes:
        if getattr(route, "path", None) == "/me":
            dependant = getattr(route, "dependant", None)
            dependencies = getattr(dependant, "dependencies", None)
            if dependencies is not None:
                for dep in dependencies:
                    if getattr(dep.call, "__name__", None) == "with_user":
                        return cast(Callable[[], User], dep.call)
    raise WithUserDependencyNotFoundError()


@pytest.mark.asyncio
async def test_me_success(app: FastAPIWithContainer, test_user: User) -> None:
    async def with_user_dep() -> User:
        return test_user

    app.dependency_overrides[get_with_user_dep()] = with_user_dep
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data: dict[str, Any] = resp.json()
    assert data["user_id"] == test_user.id
    assert data["first_name_ru"] == test_user.first_name_ru
    assert data["last_name_ru"] == test_user.last_name_ru
    assert data["first_name_en"] == test_user.first_name_en
    assert data["last_name_en"] == test_user.last_name_en
    assert data["is_admin"] == test_user.is_admin
    assert data["isu_id"] == test_user.isu_id
    assert data["patronymic_ru"] == test_user.patronymic_ru
