from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException

from volunteers.api.v1.auth.schemas import (
    ErrorLoginResponse,
    RefreshTokenRequest,
    SuccessfulLoginResponse,
    TelegramLoginRequest,
    UserResponse,
)
from volunteers.auth.deps import with_user
from volunteers.auth.jwt_tokens import (
    JWTTokenPayload,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from volunteers.auth.providers.telegram import (
    TelegramLoginConfig,
    TelegramLoginData,
    verify_telegram_login,
)
from volunteers.core.config import Config
from volunteers.core.di import Container
from volunteers.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram")
@inject
async def login(
    request: TelegramLoginRequest, config: Annotated[Config, Depends(Provide[Container.config])]
) -> SuccessfulLoginResponse | ErrorLoginResponse:
    if not verify_telegram_login(
        data=TelegramLoginData(
            auth_date=request.auth_date,
            first_name=request.first_name,
            last_name=request.last_name,
            username=request.username,
            id=request.id,
            hash=request.hash,
            photo_url=request.photo_url,
        ),
        config=TelegramLoginConfig(
            token=config.telegram.token, expiration_time=config.telegram.expiration_time
        ),
    ):
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    payload = JWTTokenPayload(user_id=request.id, role="user")
    refresh_token = await create_refresh_token(payload)
    access_token = await create_access_token(payload)
    return SuccessfulLoginResponse(
        token=access_token,
        refresh_token=refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration,
    )


@router.post("/refresh")
@inject
async def refresh(
    request: RefreshTokenRequest, config: Annotated[Config, Depends(Provide[Container.config])]
) -> SuccessfulLoginResponse | ErrorLoginResponse:
    payload = await verify_refresh_token(request.refresh_token)
    return SuccessfulLoginResponse(
        token=await create_access_token(payload),
        refresh_token=request.refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration,
    )


@router.get("/me")
async def me(user: Annotated[User, Depends(with_user)]) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
    )
