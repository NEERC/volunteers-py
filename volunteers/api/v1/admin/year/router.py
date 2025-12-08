from datetime import UTC, datetime
from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from fastapi.responses import HTMLResponse, StreamingResponse
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.core.experience import get_rank
from volunteers.models import User
from volunteers.schemas.assessment import AssessmentOut
from volunteers.schemas.position import PositionOut
from volunteers.schemas.year import YearEditIn, YearIn
from volunteers.services.export import ExportService
from volunteers.services.user import UserService
from volunteers.services.year import YearService

from .schemas import (
    AddYearRequest,
    AddYearResponse,
    AttendanceItem,
    EditYearRequest,
    RegistrationFormItem,
    RegistrationFormsResponse,
    ResultItem,
    ResultsResponse,
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
    year_in = YearIn(
        year_name=request.year_name,
        open_for_registration=False,
    )
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
            first_name_en=user.first_name_en,
            last_name_en=user.last_name_en,
            itmo_group=itmo_group,
            email=user.email,
            phone=user.phone,
            telegram_username=user.telegram_username,
            gender=user.gender,
            is_registered=is_registered,
        )
        for user, is_registered, itmo_group in user_data
    ]

    return UserListResponse(users=user_list)


@router.get(
    "/{year_id}/positions",
    response_model=list[PositionOut],
    description="Get all positions for a year (admin only - includes non-desirable positions)",
)
@inject
async def get_year_positions(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> list[PositionOut]:
    positions = await year_service.get_positions_by_year_id(year_id=year_id)
    return [
        PositionOut(
            position_id=p.id,
            year_id=p.year_id,
            name=p.name,
            can_desire=p.can_desire,
            has_halls=p.has_halls,
            is_manager=p.is_manager,
            save_for_next_year=p.save_for_next_year,
            score=p.score,
            description=p.description,
        )
        for p in positions
    ]


@router.get(
    "/{year_id}/registration-forms",
    response_model=RegistrationFormsResponse,
    description="Get all registration forms for a year (admin only)",
)
@inject
async def get_registration_forms(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> RegistrationFormsResponse:
    forms = await year_service.get_all_forms_by_year_id(year_id=year_id)

    form_items: list[RegistrationFormItem] = []
    for form in forms:
        # Get user experience data
        experience_data = await year_service.get_user_experience(form.user.id)

        form_items.append(
            RegistrationFormItem(
                form_id=form.id,
                user_id=form.user.id,
                first_name_ru=form.user.first_name_ru,
                last_name_ru=form.user.last_name_ru,
                patronymic_ru=form.user.patronymic_ru,
                first_name_en=form.user.first_name_en,
                last_name_en=form.user.last_name_en,
                isu_id=form.user.isu_id,
                phone=form.user.phone,
                email=form.user.email,
                telegram_username=form.user.telegram_username,
                gender=form.user.gender,
                itmo_group=form.itmo_group,
                comments=form.comments,
                needs_invitation=form.needs_invitation,
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
                    for p in form.desired_positions
                ],
                experience=experience_data,
                created_at=form.created_at.isoformat(),
                updated_at=form.updated_at.isoformat(),
            )
        )

    return RegistrationFormsResponse(forms=form_items)


@router.get(
    "/{year_id}/results",
    response_model=ResultsResponse,
    description="Get results for all registered volunteers in a year (admin only)",
)
@inject
async def get_year_results(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> ResultsResponse:
    results_data = await year_service.get_year_results(year_id=year_id)

    # Get all days for this year to match with attendance
    days = await year_service.get_days_by_year_id(year_id=year_id)

    result_items: list[ResultItem] = []
    for result_item in results_data:
        form = result_item.application_form

        # Convert positions to PositionOut
        positions = [
            PositionOut(
                position_id=p.id,
                year_id=p.year_id,
                name=p.name,
                can_desire=p.can_desire,
                has_halls=p.has_halls,
                is_manager=p.is_manager,
                save_for_next_year=p.save_for_next_year,
                score=p.score,
                description=p.description,
            )
            for p in result_item.positions
        ]

        # Convert assessments to AssessmentOut
        assessments = [
            AssessmentOut(
                assessment_id=a.id,
                user_day_id=a.user_day_id,
                comment=a.comment,
                value=a.value,
            )
            for a in result_item.assessments
        ]

        # Convert attendance list to AttendanceItem list
        attendance_items = [
            AttendanceItem(day_id=day.id, attendance=attendance)
            for day, attendance in zip(days, result_item.attendance, strict=True)
        ]

        result_items.append(
            ResultItem(
                user_id=form.user.id,
                first_name_ru=form.user.first_name_ru,
                last_name_ru=form.user.last_name_ru,
                patronymic_ru=form.user.patronymic_ru,
                first_name_en=form.user.first_name_en,
                last_name_en=form.user.last_name_en,
                experience=result_item.experience,
                experience_this_year=result_item.experience_this_year,
                rank=result_item.rank,
                positions=positions,
                assessments=assessments,
                total_assessment=result_item.total_assessment,
                attendance=attendance_items,
                experience_explanation=result_item.experience_explanation,
            )
        )

    return ResultsResponse(results=result_items)


@router.get(
    "/{year_id}/export-csv",
    description="Export all year data to ZIP archive with multiple CSV files",
)
@inject
async def export_year_csv(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    export_service: Annotated[ExportService, Depends(Provide[Container.export_service])],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> StreamingResponse:
    """Export all year data to ZIP archive with multiple CSV files."""
    # Get year name for filename
    year = await year_service.get_year_by_year_id(year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Year not found")

    zip_content = await export_service.export_year_data(year_id)

    # Create filename with year name and timestamp
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"year_{year.year_name.replace(' ', '_')}_{timestamp}.zip"

    logger.info(f"Exporting year {year_id} data to ZIP")

    return StreamingResponse(
        iter([zip_content]),
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/{year_id}/certificates",
    response_class=HTMLResponse,
    description="Generate certificates for all volunteers with attendance (admin only)",
)
@inject
async def generate_certificates(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> HTMLResponse:
    """Generate HTML page with certificates for volunteers who attended at least one mandatory day."""
    from pathlib import Path

    from jinja2 import Environment, FileSystemLoader

    from volunteers.models.attendance import Attendance

    # Get year info
    year = await year_service.get_year_by_year_id(year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Year not found")

    # Get results for all volunteers
    results_data = await year_service.get_year_results(year_id=year_id)

    logger.info(
        f"Certificate generation for year {year_id}: Found {len(results_data)} registered volunteers"
    )

    # Filter volunteers who have at least one YES or LATE attendance on mandatory days
    certificates: list[dict[str, str]] = []
    days = await year_service.get_days_by_year_id(year_id=year_id)

    for result_item in results_data:
        form = result_item.application_form
        calculated_experience = result_item.experience

        # Check if volunteer has any attendance (YES or LATE) on mandatory days
        has_attendance = False
        for day, attendance in zip(days, result_item.attendance, strict=True):
            if attendance in (Attendance.YES, Attendance.LATE) and day.mandatory:
                has_attendance = True
                break

        if has_attendance:
            # Format full name in English: Last Name, First Name (ФИО order)
            full_name = f"{form.user.last_name_en} {form.user.first_name_en}"

            # Get rank and format it
            rank, __ = get_rank(calculated_experience)
            rank_display = rank.replace("_", " ").title()

            certificates.append(
                {
                    "full_name": full_name,
                    "full_name_en": full_name,  # Same as full_name now
                    "rank": rank,
                    "rank_display": rank_display,
                    "experience": f"{calculated_experience:.2f}",
                }
            )

    logger.info(
        f"Generated {len(certificates)} certificates for year {year_id} (filtered by attendance)"
    )

    # Load Jinja2 template
    # Path: router.py -> year/ -> admin/ -> v1/ -> api/ -> volunteers/
    templates_dir = Path(__file__).parent.parent.parent.parent.parent / "templates"
    env = Environment(loader=FileSystemLoader(str(templates_dir)), autoescape=True)
    template = env.get_template("certificates.html")

    # Load SVG background from volunteers/static/temp.svg and convert to base64 data URI
    # Path: router.py -> year/ -> admin/ -> v1/ -> api/ -> volunteers/ -> static/
    svg_path = Path(__file__).parent.parent.parent.parent.parent / "static" / "Certificates.svg"
    svg_data_uri = ""
    logger.debug(f"Looking for SVG at: {svg_path}")
    logger.debug(f"SVG exists: {svg_path.exists()}")
    if svg_path.exists():
        import base64

        svg_content = svg_path.read_bytes()
        svg_base64 = base64.b64encode(svg_content).decode("utf-8")
        svg_data_uri = f"data:image/svg+xml;base64,{svg_base64}"
        logger.info(f"Successfully loaded SVG background from {svg_path}")
    else:
        logger.warning(f"SVG background not found at {svg_path}")

    # Render template
    html_content = template.render(
        year_name=year.year_name,
        certificates=certificates,
        svg_data_uri=svg_data_uri,
    )

    logger.info(f"Generated {len(certificates)} certificates for year {year_id}")

    return HTMLResponse(content=html_content)
