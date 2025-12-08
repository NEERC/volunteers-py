from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path

from volunteers.api.v1.attendance.schemas import (
    AllAttendanceResponse,
    AssessmentInAttendance,
    AttendanceItem,
    SaveDayAttendanceRequest,
)
from volunteers.auth.deps import with_user
from volunteers.core.di import Container
from volunteers.models.models import User
from volunteers.services.year import ManagerForYear, YearService

router = APIRouter(tags=["attendance"])


@router.post("/save")
@inject
async def save_day_attendance(
    request: SaveDayAttendanceRequest,
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    """Save attendance for a user day.

    Only admins or managers for the hall/year can set attendance.
    """
    # Get the user day with all relationships
    user_day = await year_service.get_user_day_by_id(request.user_day_id)
    if not user_day:
        raise HTTPException(status_code=404, detail="User day not found")

    manager_for_year_data = await year_service.manager_for_year(user.id, user_day.day.year_id)
    if not (
        user.is_admin
        or ManagerForYear(hall_id=user_day.hall_id, day_id=user_day.day_id) in manager_for_year_data
    ):
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to set that attendance",
        )

    # Update attendance
    await year_service.update_user_day_attendance(
        user_day_id=request.user_day_id,
        attendance=request.attendance,
    )


@router.get("/{year_id}/all", response_model=AllAttendanceResponse)
@inject
async def get_all_attendance(
    year_id: Annotated[int, Path(title="The ID of the year")],
    user: Annotated[User, Depends(with_user)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AllAttendanceResponse:
    """Get all attendance data for a year. Only admins or managers for the year can view."""
    # Check if year exists
    year = await year_service.get_year_by_year_id(year_id)
    if not year:
        raise HTTPException(status_code=404, detail="Year not found")

    # Check permissions: admin can always view, managers can view their year
    manager_for_year_data = await year_service.manager_for_year(user.id, year_id)
    if not (user.is_admin or len(manager_for_year_data) != 0):
        raise HTTPException(
            status_code=403,
            detail="Only admins or managers can view attendance",
        )

    # Get all assignments for the year
    assignments = await year_service.get_all_assignments_by_year_id(year_id)

    # Build attendance items
    attendance_items = [
        AttendanceItem(
            user_day_id=assignment.id,
            day_id=assignment.day_id,
            day_name=assignment.day.name,
            user_id=assignment.application_form.user.id,
            user_name=(
                f"{assignment.application_form.user.first_name_en} "
                f"{assignment.application_form.user.last_name_en}"
            ),
            user_telegram=assignment.application_form.user.telegram_username,
            position_id=assignment.position_id,
            position_name=assignment.position.name,
            hall_id=assignment.hall_id,
            hall_name=assignment.hall.name if assignment.hall else None,
            attendance=assignment.attendance,
            assessments=[
                AssessmentInAttendance(
                    assessment_id=assessment.id,
                    comment=assessment.comment,
                    value=assessment.value,
                )
                for assessment in assignment.assessments
            ],
        )
        for assignment in assignments
        if user.is_admin
        or ManagerForYear(hall_id=assignment.hall_id, day_id=assignment.day_id)
        in manager_for_year_data
    ]

    return AllAttendanceResponse(attendance=attendance_items)
