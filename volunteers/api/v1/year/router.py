from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.position import PositionOut
from volunteers.schemas.year import YearOut
from volunteers.services.year import YearService

from .schemas import (
    ApplicationFormYearSavedResponse,
    ApplicationFormYearSaveRequest,
    YearsResponse,
)

router = APIRouter(tags=["year"])

DB_PREFIX = 'Response from database:'


@router.get("/", description="Return info about all years")
@inject
async def get_years(
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> YearsResponse:
    years = await year_service.get_years()
    logger.debug(f'{DB_PREFIX} Got years info')
    return YearsResponse(
        years=[
            YearOut(
                year_id=y.id, year_name=y.year_name, open_for_registration=y.open_for_registration
            )
            for y in years
        ]
    )


@router.get("/{year_id}", description="Return year positions and saved user form data")
@inject
async def get_form_year(
    year_id: Annotated[int, Path(title="The ID of the year")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> ApplicationFormYearSavedResponse:
    form = await year_service.get_form_by_year_id_and_user_id(year_id=year_id, user_id=user.id)
    positions = await year_service.get_positions_by_year_id(year_id=year_id)

    logger.debug(f'{DB_PREFIX} Got user form and year positions')
    return ApplicationFormYearSavedResponse(
        positions=[PositionOut(position_id=p.id, name=p.name) for p in positions],
        desired_positions=[
            PositionOut(position_id=p.id, name=p.name) for p in form.desired_positions
        ]
        if form
        else [],
        itmo_group=form.itmo_group if form else "",
        comments=form.comments if form else "",
    )


@router.post(
    "/{year_id}",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when user signed up form for the first time"
        },
        status.HTTP_204_NO_CONTENT: {"description": "Returned when user updated form"},
    },
    description="Save user year form data",
)
@inject
async def save_form_year(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: ApplicationFormYearSaveRequest,
    response: Response,
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    form = await year_service.get_form_by_year_id_and_user_id(year_id=year_id, user_id=user.id)
    logger.debug(f'{DB_PREFIX} Got user form for sign up')
    form_in = ApplicationFormIn(
        year_id=year_id,
        user_id=user.id,
        desired_positions_ids=request.desired_positions_ids,
        itmo_group=request.itmo_group,
        comments=request.comments,
    )
    if not form:
        await year_service.create_form(form_in)
        logger.debug(f'{DB_PREFIX} Created user form')
        response.status_code = status.HTTP_201_CREATED
    else:
        await year_service.update_form(form_in)
        logger.debug(f'{DB_PREFIX} Updated user form')
        response.status_code = status.HTTP_204_NO_CONTENT
