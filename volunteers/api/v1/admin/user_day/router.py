from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.user_day import UserDayEditIn, UserDayIn
from volunteers.services.year import YearService

from .schemas import AddUserDayRequest, AddUserDayResponse, EditUserDayRequest

router = APIRouter(tags=["user-day"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {"description": "Returned when user day successfully added"},
    },
    description="Add new user day",
)
@inject
async def add_user_day(
    request: AddUserDayRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddUserDayResponse:
    user_day_in = UserDayIn(
        application_form_id=request.application_form_id,
        day_id=request.day_id,
        information=request.information,
        attendance=request.attendance,
    )
    user_day = await year_service.add_user_day(user_day_in=user_day_in)
    logger.info("Added user day")

    response.status_code = status.HTTP_201_CREATED
    return AddUserDayResponse(user_day_id=user_day.id)


@router.post("/{user_day_id}/edit")
@inject
async def edit_user_day(
    user_day_id: Annotated[int, Path(title="The ID of the user day")],
    request: EditUserDayRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    user_day_edit_in = UserDayEditIn(information=request.information, attendance=request.attendance)
    await year_service.edit_user_day_by_user_day_id(
        user_day_id=user_day_id, user_day_edit_in=user_day_edit_in
    )
    logger.info("User day has been edited")
