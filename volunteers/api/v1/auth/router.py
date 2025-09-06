from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from volunteers.api.v1.auth.schemas import (
    ErrorLoginResponse,
    RefreshTokenRequest,
    RegistrationRequest,
    SuccessfulLoginResponse,
    TelegramLoginRequest,
    UserResponse,
    UserUpdateRequest,
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
from volunteers.schemas.user import UserIn, UserUpdate
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
        logger.info("Invalid Telegram login")
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    if _ := await user_service.get_user_by_telegram_id(telegram_id=request.telegram_id):
        logger.warning("Detected an attempt to register an existing user again")
        raise HTTPException(status_code=409, detail="User is already registered")

    user_in = UserIn(
        telegram_id=request.telegram_id,
        first_name_ru=request.first_name_ru,
        last_name_ru=request.last_name_ru,
        full_name_en=request.full_name_en,
        isu_id=request.isu_id,
        patronymic_ru=request.patronymic_ru,
        phone=request.phone,
        email=request.email,
        telegram_username=request.telegram_username,
        is_admin=False,
    )
    await user_service.create_user(user_in)
    logger.info("User has been registered")

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
        logger.info("Invalid Telegram login")
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    user = await user_service.get_user_by_telegram_id(telegram_id=request.telegram_id)
    if not user:
        logger.warning("Detected an attempt to authorize a non-existent user")
        raise HTTPException(status_code=403, detail="User is not found")

    # Update telegram username on each login
    if user.telegram_username != request.telegram_username:
        user_update = UserUpdate(telegram_username=request.telegram_username)
        await user_service.update_user(telegram_id=request.telegram_id, user_update=user_update)
        logger.info(f"Updated telegram username for user {request.telegram_id}")

    logger.info("User has been authorized")

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
        phone=user.phone,
        email=user.email,
        telegram_username=user.telegram_username,
    )


@router.post("/update")
@inject
async def update_user(
    user_update: UserUpdateRequest,
    current_user: Annotated[User, Depends(with_user)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> UserResponse:
    updated_user = await user_service.update_user(
        telegram_id=current_user.telegram_id,
        user_update=UserUpdate(**user_update.model_dump()),
    )
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        user_id=updated_user.id,
        first_name_ru=updated_user.first_name_ru,
        last_name_ru=updated_user.last_name_ru,
        full_name_en=updated_user.full_name_en,
        is_admin=updated_user.is_admin,
        isu_id=updated_user.isu_id,
        patronymic_ru=updated_user.patronymic_ru,
        phone=updated_user.phone,
        email=updated_user.email,
        telegram_username=updated_user.telegram_username,
    )
