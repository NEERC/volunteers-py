from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.user import UserUpdate
from volunteers.services.user import UserService

from .schemas import AllUsersResponse, EditUserRequest, UserResponse

router = APIRouter(tags=["user"])


@router.get(
    "",
    response_model=AllUsersResponse,
    description="Get list of all users",
)
@inject
async def get_all_users(
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> AllUsersResponse:
    users = await user_service.get_all_users()
    user_list = [
        UserResponse(
            user_id=user.id,
            telegram_id=user.telegram_id,
            first_name_ru=user.first_name_ru,
            last_name_ru=user.last_name_ru,
            patronymic_ru=user.patronymic_ru,
            full_name_en=user.full_name_en,
            isu_id=user.isu_id,
            phone=user.phone,
            email=user.email,
            telegram_username=user.telegram_username,
            is_admin=user.is_admin,
        )
        for user in users
    ]
    return AllUsersResponse(users=user_list)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    description="Get user by ID",
)
@inject
async def get_user_by_id(
    user_id: Annotated[int, Path(title="The ID of the user")],
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> UserResponse:
    user = await user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        user_id=user.id,
        telegram_id=user.telegram_id,
        first_name_ru=user.first_name_ru,
        last_name_ru=user.last_name_ru,
        patronymic_ru=user.patronymic_ru,
        full_name_en=user.full_name_en,
        isu_id=user.isu_id,
        phone=user.phone,
        email=user.email,
        telegram_username=user.telegram_username,
        is_admin=user.is_admin,
    )


@router.post("/{user_id}/edit")
@inject
async def edit_user(
    user_id: Annotated[int, Path(title="The ID of the user")],
    request: EditUserRequest,
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> UserResponse:
    user_update = UserUpdate(**request.model_dump())
    updated_user = await user_service.update_user(user_id=user_id, user_update=user_update)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"User {user_id} has been edited")
    return UserResponse(
        user_id=updated_user.id,
        telegram_id=updated_user.telegram_id,
        first_name_ru=updated_user.first_name_ru,
        last_name_ru=updated_user.last_name_ru,
        patronymic_ru=updated_user.patronymic_ru,
        full_name_en=updated_user.full_name_en,
        isu_id=updated_user.isu_id,
        phone=updated_user.phone,
        email=updated_user.email,
        telegram_username=updated_user.telegram_username,
        is_admin=updated_user.is_admin,
    )
