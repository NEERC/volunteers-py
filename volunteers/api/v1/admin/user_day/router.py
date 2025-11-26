from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.models.attendance import Attendance
from volunteers.schemas.user_day import UserDayEditIn, UserDayIn
from volunteers.services.year import YearService

from .schemas import (
    AddUserDayRequest,
    AddUserDayResponse,
    AssignmentItem,
    AssignmentsResponse,
    EditUserDayRequest,
)

router = APIRouter(tags=["user-day"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when user day successfully added",
            "model": AddUserDayResponse,
        },
    },
    description="Add new user day",
)
@inject
async def add_user_day(
    request: AddUserDayRequest,
    response: Response,
    user: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddUserDayResponse:
    user_day_in = UserDayIn(
        application_form_id=request.application_form_id,
        day_id=request.day_id,
        information=request.information,
        attendance=Attendance.UNKNOWN,  # Default attendance, will be set via attendance API
        position_id=request.position_id,
        hall_id=request.hall_id,
    )
    user_day = await year_service.add_user_day(user_day_in=user_day_in, author=user)
    logger.info("Added user day")

    response.status_code = status.HTTP_201_CREATED
    return AddUserDayResponse(user_day_id=user_day.id)


@router.post("/{user_day_id}/edit")
@inject
async def edit_position(
    user_day_id: Annotated[int, Path(title="The ID of the user day")],
    request: EditUserDayRequest,
    user: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    user_day_edit_in = UserDayEditIn(
        information=request.information,
        attendance=None,  # Attendance is managed via attendance API
        position_id=request.position_id,
        hall_id=request.hall_id,
    )
    await year_service.edit_user_day_by_user_day_id(
        user_day_id=user_day_id, user_day_edit_in=user_day_edit_in, author=user
    )
    logger.info("User day has been edited")


@router.delete(
    "/{user_day_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Delete a user day assignment",
)
@inject
async def delete_user_day(
    user_day_id: Annotated[int, Path(title="The ID of the user day")],
    user: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    await year_service.delete_user_day_by_user_day_id(user_day_id=user_day_id, author=user)
    logger.info("User day has been deleted")


@router.get(
    "/day/{day_id}/assignments",
    response_model=AssignmentsResponse,
    description="Get all assignments for a day (admin only)",
)
@inject
async def get_day_assignments(
    day_id: Annotated[int, Path(title="The ID of the day")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AssignmentsResponse:
    assignments = await year_service.get_all_assignments_by_day_id(day_id=day_id)

    assignment_items = [
        AssignmentItem(
            user_day_id=assignment.id,
            application_form_id=assignment.application_form.id,
            position_id=assignment.position.id,
            hall_id=assignment.hall.id if assignment.hall else None,
        )
        for assignment in assignments
    ]

    return AssignmentsResponse(assignments=assignment_items)
