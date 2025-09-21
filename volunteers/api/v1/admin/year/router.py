from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.year import YearEditIn, YearIn
from volunteers.services.user import UserService
from volunteers.services.year import YearService

from .schemas import (
    AddYearRequest,
    AddYearResponse,
    EditYearRequest,
    UserListItem,
    UserListResponse,
)

router = APIRouter(tags=["year"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when year successfully added",
            "model": AddYearResponse,
        },
    },
    description="Add new year",
)
@inject
async def add_year(
    request: AddYearRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddYearResponse:
    year_in = YearIn(year_name=request.year_name, open_for_registration=False)
    year = await year_service.add_year(year_in=year_in)
    logger.info(f"Added year {request.year_name}")

    response.status_code = status.HTTP_201_CREATED
    return AddYearResponse(year_id=year.id)


@router.post("/{year_id}/edit")
@inject
async def edit_year(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: EditYearRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    year_edit_in = YearEditIn(
        year_name=request.year_name, open_for_registration=request.open_for_registration
    )
    await year_service.edit_year_by_year_id(year_id=year_id, year_edit_in=year_edit_in)
    logger.info("Year has been edited")


@router.get(
    "/{year_id}/users",
    response_model=UserListResponse,
    description="Get list of all users with their registration status for a specific year",
)
@inject
async def get_users_list(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> UserListResponse:
    user_data = await user_service.get_users_with_registration_status(year_id)

    user_list = [
        UserListItem(
            id=user.id,
            first_name_ru=user.first_name_ru,
            last_name_ru=user.last_name_ru,
            patronymic_ru=user.patronymic_ru,
            full_name_en=user.full_name_en,
            itmo_group=itmo_group,
            email=user.email,
            phone=user.phone,
            telegram_username=user.telegram_username,
            is_registered=is_registered,
        )
        for user, is_registered, itmo_group in user_data
    ]

    return UserListResponse(users=user_list)
