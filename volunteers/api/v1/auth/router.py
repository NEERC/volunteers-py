from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, HTTPException

from volunteers.api.v1.auth.schemas import (
    ErrorLoginResponse,
    RefreshTokenRequest,
    SuccessfullLoginResponse,
    TelegramLoginRequest,
)
from volunteers.auth.jwt_tokens import (
    JWTTokenPayload,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from volunteers.auth.providers.telegram import TelegramLoginData, verify_telegram_login
from volunteers.core.config import Config
from volunteers.core.di import Container

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/telegram")
@inject
async def login(request: TelegramLoginRequest, config: Config = Provide[Container.config]) -> SuccessfullLoginResponse | ErrorLoginResponse:
    if not await verify_telegram_login(TelegramLoginData(
        auth_date=request.auth_date,
        first_name=request.first_name,
        last_name=request.last_name,
        username=request.username,
        id=request.id,
        hash=request.hash,
    )):
        raise HTTPException(status_code=401, detail="Invalid Telegram login")

    payload = JWTTokenPayload(user_id=request.id, role="user")
    refresh_token = await create_refresh_token(payload)
    access_token = await create_access_token(payload)
    return SuccessfullLoginResponse(
        token=access_token,
        refresh_token=refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration
    )

@router.post("/refresh")
@inject
async def refresh(request: RefreshTokenRequest, config: Config = Provide[Container.config]) -> SuccessfullLoginResponse | ErrorLoginResponse:
    payload = await verify_refresh_token(request.refresh_token, config)
    return SuccessfullLoginResponse(
        token=await create_access_token(payload),
        refresh_token=request.refresh_token,
        expires_in=config.jwt.expiration,
        refresh_expires_in=config.jwt.refresh_expiration
    )
