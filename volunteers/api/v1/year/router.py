from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.day import DayOut
from volunteers.schemas.day_assignment import DayAssignmentItem
from volunteers.schemas.position import PositionOut
from volunteers.schemas.year import YearOut
from volunteers.services.i18n import I18nService
from volunteers.services.year import YearService

from .schemas import (
    ApplicationFormYearSavedResponse,
    ApplicationFormYearSaveRequest,
    DayAssignmentsResponse,
    YearsResponse,
)

router = APIRouter(tags=["year"])

DB_PREFIX = "Response from database:"


@router.get("/", description="Return info about all years")
@inject
async def get_years(
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> YearsResponse:
    years = await year_service.get_years()
    logger.debug(f"{DB_PREFIX} Got years info")
    return YearsResponse(
        years=[
            YearOut(
                year_id=y.id, year_name=y.year_name, open_for_registration=y.open_for_registration
            )
            for y in years
        ]
    )


@router.get("/{year_id}", description="Return year positions, days and saved user form data")
@inject
async def get_form_year(
    year_id: Annotated[int, Path(title="The ID of the year")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> ApplicationFormYearSavedResponse:
    year = await year_service.get_year_by_year_id(year_id=year_id)

    if not year:
        raise HTTPException(status_code=404, detail="Year not found")

    form = await year_service.get_form_by_year_id_and_user_id(year_id=year_id, user_id=user.id)
    positions = await year_service.get_positions_by_year_id(year_id=year_id)
    days = await year_service.get_days_by_year_id(year_id=year_id)

    logger.debug(f"{DB_PREFIX} Got user form and year positions")
    return ApplicationFormYearSavedResponse(
        open_for_registration=year.open_for_registration,
        positions=[
            PositionOut(
                position_id=p.id,
                year_id=p.year_id,
                name=p.name,
                can_desire=p.can_desire,
                has_halls=p.has_halls,
            )
            for p in positions
            if p.can_desire
        ],
        days=[
            DayOut(day_id=d.id, year_id=d.year_id, name=d.name, information=d.information)
            for d in days
        ],
        desired_positions=[
            PositionOut(
                position_id=p.id,
                year_id=p.year_id,
                name=p.name,
                can_desire=p.can_desire,
                has_halls=p.has_halls,
            )
            for p in sorted(form.desired_positions, key=lambda x: x.id)
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
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> None:
    year = await year_service.get_year_by_year_id(year_id=year_id)

    if not year:
        raise HTTPException(status_code=404, detail=i18n.translate("Year not found"))

    if not year.open_for_registration:
        raise HTTPException(
            status_code=403, detail=i18n.translate("Year is not open for registration")
        )

    form = await year_service.get_form_by_year_id_and_user_id(year_id=year_id, user_id=user.id)
    logger.debug(f"{DB_PREFIX} Got user form for sign up")
    form_in = ApplicationFormIn(
        year_id=year_id,
        user_id=user.id,
        desired_positions_ids=request.desired_positions_ids,
        itmo_group=request.itmo_group,
        comments=request.comments,
    )
    if not form:
        await year_service.create_form(form_in)
        logger.debug(f"{DB_PREFIX} Created user form")
        response.status_code = status.HTTP_201_CREATED
    else:
        await year_service.update_form(form_in)
        logger.debug(f"{DB_PREFIX} Updated user form")
        response.status_code = status.HTTP_204_NO_CONTENT


@router.get(
    "/{year_id}/days/{day_id}/assignments",
    response_model=DayAssignmentsResponse,
    description="Get all assignments for a day (user-facing, no admin privileges required)",
)
@inject
async def get_day_assignments(
    year_id: Annotated[int, Path(title="The ID of the year")],
    day_id: Annotated[int, Path(title="The ID of the day")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> DayAssignmentsResponse:
    # Verify the day belongs to the year
    year = await year_service.get_year_by_year_id(year_id=year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Year not found")

    day = await year_service.get_day_by_id(day_id=day_id)
    if not day or day.year_id != year_id:
        raise HTTPException(status_code=404, detail="Day not found")

    assignments = await year_service.get_all_assignments_by_day_id(day_id=day_id)

    assignment_items = [
        DayAssignmentItem(
            name=assignment.application_form.user.full_name_en,
            telegram=assignment.application_form.user.telegram_username,
            position=assignment.position.name,
            hall=assignment.hall.name if assignment.hall else None,
            attendance=assignment.attendance,
        )
        for assignment in assignments
    ]

    logger.debug(f"{DB_PREFIX} Got day assignments for user-facing API")
    return DayAssignmentsResponse(assignments=assignment_items)
