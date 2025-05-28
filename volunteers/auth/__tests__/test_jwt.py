import datetime
import os
from typing import Any

import pytest
from dotenv import load_dotenv
from fastapi import HTTPException

import volunteers.auth.jwt_tokens as jwt_tokens
from volunteers.auth.jwt_tokens import JWTTokenPayload
from volunteers.core.config import Config

load_dotenv()


class DummyJWTConfig:
    secret: str
    algorithm: str
    expiration: int
    refresh_expiration: int

    def __init__(self) -> None:
        self.secret = os.environ.get("VOLUNTEERS_JWT__SECRET", "default-test-secret")
        self.algorithm = os.environ.get("VOLUNTEERS_JWT__ALGORITHM", "HS256")
        self.expiration = int(os.environ.get("VOLUNTEERS_JWT__EXPIRATION", "60"))
        self.refresh_expiration = int(os.environ.get("VOLUNTEERS_JWT__REFRESH_EXPIRATION", "120"))


class DummyConfig(Config):
    # Inherit from Config for full compatibility, but override init
    def __init__(self) -> None:
        object.__setattr__(self, "jwt", DummyJWTConfig())


@pytest.fixture
def dummy_config(monkeypatch: pytest.MonkeyPatch) -> Config:
    config = DummyConfig()
    monkeypatch.setattr(jwt_tokens, "Provide", lambda x: config)
    monkeypatch.setattr(jwt_tokens, "Container", None)
    monkeypatch.setattr(jwt_tokens, "inject", lambda x: x)
    return config


@pytest.fixture
def token_payload() -> JWTTokenPayload:
    return JWTTokenPayload(user_id=42, role="volunteer")


def test_create_token_and_decode_token(dummy_config: Config) -> None:
    payload: dict[str, Any] = {
        "user_id": 1,
        "role": "admin",
        "type": "access",
        "exp": datetime.datetime.now(tz=datetime.UTC) + datetime.timedelta(seconds=60),
        "iat": datetime.datetime.now(tz=datetime.UTC),
    }
    token = jwt_tokens.create_token(payload, config=dummy_config)
    decoded = jwt_tokens.decode_token(token, config=dummy_config)
    assert decoded["user_id"] == 1
    assert decoded["role"] == "admin"
    assert decoded["type"] == "access"


@pytest.mark.asyncio
async def test_create_access_token_and_verify(
    dummy_config: Config, token_payload: JWTTokenPayload
) -> None:
    token = await jwt_tokens.create_access_token(token_payload, config=dummy_config)
    decoded = jwt_tokens.decode_token(token, config=dummy_config)
    assert decoded["type"] == "access"
    assert decoded["user_id"] == token_payload.user_id
    assert decoded["role"] == token_payload.role

    verified = await jwt_tokens.verify_access_token(token, config=dummy_config)
    assert isinstance(verified, JWTTokenPayload)
    assert verified.user_id == token_payload.user_id
    assert verified.role == token_payload.role


@pytest.mark.asyncio
async def test_create_refresh_token_and_verify(
    dummy_config: Config, token_payload: JWTTokenPayload
) -> None:
    token = await jwt_tokens.create_refresh_token(token_payload, config=dummy_config)
    decoded = jwt_tokens.decode_token(token, config=dummy_config)
    assert decoded["type"] == "refresh"
    assert decoded["user_id"] == token_payload.user_id
    assert decoded["role"] == token_payload.role

    verified = await jwt_tokens.verify_refresh_token(token, config=dummy_config)
    assert isinstance(verified, JWTTokenPayload)
    assert verified.user_id == token_payload.user_id
    assert verified.role == token_payload.role


def test_decode_token_invalid_signature(dummy_config: Config) -> None:
    payload: dict[str, Any] = {
        "user_id": 1,
        "role": "admin",
        "type": "access",
        "exp": datetime.datetime.now(tz=datetime.UTC) + datetime.timedelta(seconds=60),
        "iat": datetime.datetime.now(tz=datetime.UTC),
    }
    token = jwt_tokens.create_token(payload, config=dummy_config)
    bad_token = token + "tampered"
    with pytest.raises(HTTPException) as exc:
        jwt_tokens.decode_token(bad_token, config=dummy_config)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token"


def test_decode_token_expired(dummy_config: Config) -> None:
    payload: dict[str, Any] = {
        "user_id": 1,
        "role": "admin",
        "type": "access",
        "exp": datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(seconds=10),
        "iat": datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(seconds=100),
    }
    token = jwt_tokens.create_token(payload, config=dummy_config)
    with pytest.raises(HTTPException) as exc:
        jwt_tokens.decode_token(token, config=dummy_config)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Token expired"


@pytest.mark.asyncio
async def test_verify_access_token_wrong_type(
    dummy_config: Config, token_payload: JWTTokenPayload
) -> None:
    token = await jwt_tokens.create_refresh_token(token_payload, config=dummy_config)
    with pytest.raises(HTTPException) as exc:
        await jwt_tokens.verify_access_token(token, config=dummy_config)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token type"


@pytest.mark.asyncio
async def test_verify_refresh_token_wrong_type(
    dummy_config: Config, token_payload: JWTTokenPayload
) -> None:
    token = await jwt_tokens.create_access_token(token_payload, config=dummy_config)
    with pytest.raises(HTTPException) as exc:
        await jwt_tokens.verify_refresh_token(token, config=dummy_config)
    assert exc.value.status_code == 401
    assert exc.value.detail == "Invalid token type"
