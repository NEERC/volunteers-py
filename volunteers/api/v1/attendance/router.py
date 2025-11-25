from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path

from volunteers.api.v1.attendance.schemas import SaveDayAttendanceRequest
from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models.models import User
from volunteers.services.year import YearService

router = APIRouter(tags=["attendance"])


@router.post("/save")
@inject
async def save_day_attendance(
    request: SaveDayAttendanceRequest,
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    manager_for_years = await year_service.manager_for_years(user_id=user.id)
    # TODO:
    if manager_for_years:
        pass


@router.get("/{year_id}/all")
@inject
async def get_all_attendance(
    year_id: Annotated[int, Path(title="The ID of the year")],
) -> None:
    pass
