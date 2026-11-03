from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models import IdentityProvider, User
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.day import DayOutUser
from volunteers.schemas.day_assignment import DayAssignmentItem
from volunteers.schemas.position import PositionOut
from volunteers.services.i18n import I18nService
from volunteers.services.identity import IdentityService
from volunteers.services.year import (
    AssignmentConfirmation,
    AssignmentsNotPublished,
    DayNotFound,
    NotAssignedToDay,
    YearService,
)

from .schemas import (
    ApplicationFormYearSavedResponse,
    ApplicationFormYearSaveRequest,
    AssignmentConfirmationResponse,
    DayAssignmentsResponse,
    YearOut,
    YearsResponse,
)

router = APIRouter(tags=["year"])

DB_PREFIX = "Response from database:"


@router.get("/", description="Return info about all years")
@inject
async def get_years(
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
    user: Annotated[User, Depends(with_user)],
) -> YearsResponse:
    years = await year_service.get_years()
    manager_for_years = await year_service.manager_for_years(user_id=user.id)
    logger.debug(f"{DB_PREFIX} Got years info")
    return YearsResponse(
        years=[
            YearOut(
                year_id=y.id,
                year_name=y.year_name,
                open_for_registration=y.open_for_registration,
                is_manager=y.id in manager_for_years,
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
                is_manager=p.is_manager,
                save_for_next_year=p.save_for_next_year,
            )
            for p in positions
            if p.can_desire
        ],
        days=[DayOutUser(day_id=d.id, name=d.name) for d in days],
        desired_positions=[
            PositionOut(
                position_id=p.id,
                year_id=p.year_id,
                name=p.name,
                can_desire=p.can_desire,
                has_halls=p.has_halls,
                is_manager=p.is_manager,
                save_for_next_year=p.save_for_next_year,
            )
            for p in sorted(form.desired_positions, key=lambda x: x.id)
        ]
        if form
        else [],
        itmo_group=form.itmo_group if form else "",
        comments=form.comments if form else "",
        additional_skills=form.additional_skills if form else "",
        needs_invitation=form.needs_invitation if form else False,
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
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> None:
    year = await year_service.get_year_by_year_id(year_id=year_id)

    if not year:
        raise HTTPException(status_code=404, detail=i18n.translate("Year not found"))

    if not year.open_for_registration:
        raise HTTPException(
            status_code=403, detail=i18n.translate("Year is not open for registration")
        )

    identities = await identity_service.get_user_identities(user.id)
    has_telegram = any(identity.provider == IdentityProvider.TELEGRAM for identity in identities)

    if not has_telegram:
        raise HTTPException(
            status_code=403,
            detail=i18n.translate("Telegram account must be linked to register"),
        )

    form = await year_service.get_form_by_year_id_and_user_id(year_id=year_id, user_id=user.id)
    logger.debug(f"{DB_PREFIX} Got user form for sign up")
    form_in = ApplicationFormIn(
        year_id=year_id,
        user_id=user.id,
        desired_positions_ids=request.desired_positions_ids,
        itmo_group=request.itmo_group,
        comments=request.comments,
        additional_skills=request.additional_skills,
        needs_invitation=request.needs_invitation,
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

    # Check if assignments are published
    if not (day.assignment_published or user.is_admin):
        logger.debug(f"{DB_PREFIX} Assignments not published for day {day_id}")
        return DayAssignmentsResponse(assignments=[], is_published=False)

    views = await year_service.get_day_assignments_for_viewer(day=day, viewer=user)

    assignment_items = [
        DayAssignmentItem(
            name=f"{view.assignment.application_form.user.first_name_en} {view.assignment.application_form.user.last_name_en}",
            telegram=view.assignment.application_form.user.telegram_username,
            position=view.assignment.position.name,
            hall=view.assignment.hall.name if view.assignment.hall else None,
            confirmed=view.confirmed,
        )
        for view in views
    ]

    logger.debug(f"{DB_PREFIX} Got day assignments for user-facing API")
    return DayAssignmentsResponse(
        assignments=assignment_items, is_published=day.assignment_published
    )


def _confirmation_response(confirmation: AssignmentConfirmation) -> AssignmentConfirmationResponse:
    assignment = confirmation.assignment
    return AssignmentConfirmationResponse(
        day_name=confirmation.day.name,
        day_information=confirmation.day.information,
        state=confirmation.state,
        position=assignment.position.name if assignment else None,
        hall=assignment.hall.name if assignment and assignment.hall else None,
        attendance=assignment.attendance if assignment else None,
    )


@router.get(
    "/{year_id}/days/{day_id}/confirmation",
    description="Get the assignment of the current user on a day, to confirm that they will come",
)
@inject
async def get_assignment_confirmation(
    year_id: Annotated[int, Path(title="The ID of the year")],
    day_id: Annotated[int, Path(title="The ID of the day")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AssignmentConfirmationResponse:
    try:
        confirmation = await year_service.get_assignment_confirmation(
            year_id=year_id, day_id=day_id, user_id=user.id
        )
    except DayNotFound:
        raise HTTPException(status_code=404, detail=i18n.translate("Day not found")) from None
    return _confirmation_response(confirmation)


@router.post(
    "/{year_id}/days/{day_id}/confirmation",
    description="Confirm that the current user will come on a day. "
    "Does nothing when the attendance is already set.",
)
@inject
async def confirm_assignment(
    year_id: Annotated[int, Path(title="The ID of the year")],
    day_id: Annotated[int, Path(title="The ID of the day")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
    i18n: Annotated[I18nService, Depends(Provide[Container.i18n_service])],
) -> AssignmentConfirmationResponse:
    try:
        confirmation = await year_service.confirm_assignment(
            year_id=year_id, day_id=day_id, user_id=user.id
        )
    except DayNotFound:
        raise HTTPException(status_code=404, detail=i18n.translate("Day not found")) from None
    except NotAssignedToDay as exc:
        raise HTTPException(status_code=404, detail=i18n.translate(str(exc))) from None
    except AssignmentsNotPublished as exc:
        raise HTTPException(status_code=403, detail=i18n.translate(str(exc))) from None
    logger.info(f"User {user.id} confirmed day {day_id}: {confirmation.state}")
    return _confirmation_response(confirmation)
