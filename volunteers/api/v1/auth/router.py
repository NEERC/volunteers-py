from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException

from volunteers.api.v1.auth.schemas import (
    ErrorLoginResponse,
    RefreshTokenRequest,
    RegistrationRequest,
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
from volunteers.models import User
from volunteers.schemas.user import UserIn
from volunteers.services.user import UserService

router = APIRouter(tags=["auth"])


@router.post("/telegram/register")
@inject
async def register(
    request: RegistrationRequest,
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
) -> SuccessfulLoginResponse:
    if not verify_telegram_login(
        data=TelegramLoginData(
            id=request.telegram_id,
            auth_date=request.telegram_auth_date,
            first_name=request.telegram_first_name,
            hash=request.telegram_hash,
            last_name=request.telegram_last_name,
            username=request.telegram_username,
            photo_url=request.telegram_photo_url,
        ),
        config=TelegramLoginConfig(
            token=config.telegram.token, expiration_time=config.telegram.expiration_time
        ),
    ):
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    if _ := await user_service.get_user_by_telegram_id(telegram_id=request.telegram_id):
        raise HTTPException(status_code=409, detail="User is already registered")

    user_in = UserIn(
        telegram_id=request.telegram_id,
        first_name_ru=request.first_name_ru,
        last_name_ru=request.last_name_ru,
        full_name_en=request.full_name_en,
        isu_id=request.isu_id,
        patronymic_ru=request.patronymic_ru,
        is_admin=False,
    )
    await user_service.create_user(user_in)

    payload = JWTTokenPayload(user_id=request.telegram_id, role="user")
    refresh_token = await create_refresh_token(payload)
    access_token = await create_access_token(payload)

    return SuccessfulLoginResponse(
        token=access_token,
        refresh_token=refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration,
    )


@router.post("/telegram/login")
@inject
async def login(
    request: TelegramLoginRequest,
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    config: Annotated[Config, Depends(Provide[Container.config])],
) -> SuccessfulLoginResponse | ErrorLoginResponse:
    if not verify_telegram_login(
        data=TelegramLoginData(
            id=request.telegram_id,
            auth_date=request.telegram_auth_date,
            first_name=request.telegram_first_name,
            hash=request.telegram_hash,
            last_name=request.telegram_last_name,
            username=request.telegram_username,
            photo_url=request.telegram_photo_url,
        ),
        config=TelegramLoginConfig(
            token=config.telegram.token, expiration_time=config.telegram.expiration_time
        ),
    ):
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    user = await user_service.get_user_by_telegram_id(telegram_id=request.telegram_id)
    if not user:
        raise HTTPException(status_code=401, detail="User is not registered")

    payload = JWTTokenPayload(user_id=request.telegram_id, role="user")
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
        user_id=user.id,
        first_name_ru=user.first_name_ru,
        last_name_ru=user.last_name_ru,
        full_name_en=user.full_name_en,
        is_admin=user.is_admin,
        isu_id=user.isu_id,
        patronymic_ru=user.patronymic_ru,
    )
