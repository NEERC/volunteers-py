from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from volunteers.auth.jwt_tokens import verify_access_token
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.services.user import UserService

JWTBearer = HTTPBearer()


@inject
async def with_user(
    token: Annotated[HTTPAuthorizationCredentials, Depends(JWTBearer)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> User:
    payload = await verify_access_token(token.credentials)
    user = await user_service.get_user_by_id(payload.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@inject
async def with_admin(user: Annotated[User, Depends(with_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user
