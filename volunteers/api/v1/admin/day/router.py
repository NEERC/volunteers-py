from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.day import DayEditIn, DayIn, DayOutAdmin
from volunteers.services.year import YearService

from .schemas import AddDayRequest, AddDayResponse, EditDayRequest

router = APIRouter(tags=["day"])


@router.get(
    "/year/{year_id}",
    response_model=list[DayOutAdmin],
    description="Get all days for a year (admin only)",
)
@inject
async def get_year_days(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> list[DayOutAdmin]:
    days = await year_service.get_days_by_year_id(year_id=year_id)
    return [
        DayOutAdmin(
            day_id=day.id,
            year_id=day.year_id,
            name=day.name,
            information=day.information,
            score=day.score,
            mandatory=day.mandatory,
        )
        for day in days
    ]


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when day successfully added",
            "model": AddDayResponse,
        },
    },
    description="Add new day",
)
@inject
async def add_day(
    request: AddDayRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddDayResponse:
    day_in = DayIn(
        year_id=request.year_id,
        name=request.name,
        information=request.information,
        score=request.score,
        mandatory=request.mandatory,
    )
    day = await year_service.add_day(day_in=day_in)
    logger.info(f"Added day {day.name}")

    response.status_code = status.HTTP_201_CREATED
    return AddDayResponse(day_id=day.id)


@router.post("/{day_id}/edit")
@inject
async def edit_day(
    day_id: Annotated[int, Path(title="The ID of the day")],
    request: EditDayRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    day_edit_in = DayEditIn(
        name=request.name,
        information=request.information,
        score=request.score,
        mandatory=request.mandatory,
    )
    await year_service.edit_day_by_day_id(day_id=day_id, day_edit_in=day_edit_in)
    logger.info("Day has been edited")
