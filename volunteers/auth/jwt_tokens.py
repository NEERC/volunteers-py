import datetime
from typing import Any

import jwt
from dependency_injector.wiring import Provide, inject
from fastapi import HTTPException
from loguru import logger
from pydantic import BaseModel

from volunteers.core.config import Config
from volunteers.core.di import Container


class JWTTokenPayload(BaseModel):
    user_id: int
    role: str


@inject
def create_token(payload: dict[str, Any], config: Config = Provide[Container.config]) -> str:
    return jwt.encode(payload, config.jwt.secret, algorithm=config.jwt.algorithm)


@inject
async def create_refresh_token(
    payload: JWTTokenPayload, config: Config = Provide[Container.config]
) -> str:
    logger.debug("Refresh token created")
    return create_token(
        {
            **payload.model_dump(),
            "exp": datetime.datetime.now(tz=datetime.UTC)
            + datetime.timedelta(seconds=config.jwt.refresh_expiration),
            "iat": datetime.datetime.now(tz=datetime.UTC),
            "type": "refresh",
        }
    )


@inject
async def create_access_token(
    payload: JWTTokenPayload, config: Config = Provide[Container.config]
) -> str:
    logger.debug("Access token created")
    return create_token(
        {
            **payload.model_dump(),
            "exp": datetime.datetime.now(tz=datetime.UTC)
            + datetime.timedelta(seconds=config.jwt.expiration),
            "iat": datetime.datetime.now(tz=datetime.UTC),
            "type": "access",
        }
    )


@inject
def decode_token(token: str, config: Config = Provide[Container.config]) -> dict[str, Any]:
    try:
        token_data: dict[str, Any] = jwt.decode(
            token,
            key=config.jwt.secret,
            algorithms=[config.jwt.algorithm],
            options={"verify_signature": True},
        )
    except jwt.ExpiredSignatureError as e:
        logger.error(f"Token expired: {e}")
        raise HTTPException(status_code=401, detail="Token expired") from e
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token") from e
    logger.debug("Token is valid")
    return token_data


@inject
async def verify_access_token(
    token: str, config: Config = Provide[Container.config]
) -> JWTTokenPayload:
    payload = decode_token(token)
    if payload["type"] != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return JWTTokenPayload(**payload)


@inject
async def verify_refresh_token(
    token: str, config: Config = Provide[Container.config]
) -> JWTTokenPayload:
    payload = decode_token(token)
    if payload["type"] != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return JWTTokenPayload(**payload)
