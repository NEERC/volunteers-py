"""Service for exporting data to CSV format."""

import csv
import zipfile
from io import BytesIO, StringIO

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from volunteers.models import (
    ApplicationForm,
    Day,
    Hall,
    Position,
    User,
    UserDay,
    Year,
)
from volunteers.models.attendance import Attendance

from .base import BaseService


class YearNotFoundError(ValueError):
    """Year not found in database."""

    def __init__(self, year_id: int) -> None:
        super().__init__(f"Year with id {year_id} not found")
        self.year_id = year_id


class ExportService(BaseService):
    """Service for exporting data to CSV format."""

    async def export_year_data(self, year_id: int) -> bytes:
        """
        Export all year data to ZIP archive with multiple CSV files.

        Returns ZIP file content as bytes containing:
        - users.csv - User information
        - assignments.csv - Day assignments
        - assessments.csv - All assessments
        - days.csv - Days info
        - positions.csv - Positions info
        - halls.csv - Halls info
        """
        async with self.session_scope() as session:
            # Get year info
            year_result = await session.execute(select(Year).where(Year.id == year_id))
            year = year_result.scalar_one_or_none()

            if not year:
                raise YearNotFoundError(year_id)

            # Get all assignments for this year with all related data
            assignments_result = await session.execute(
                select(UserDay)
                .join(ApplicationForm)
                .where(ApplicationForm.year_id == year_id)
                .options(
                    selectinload(UserDay.application_form).selectinload(ApplicationForm.user),
                    selectinload(UserDay.application_form).selectinload(
                        ApplicationForm.desired_positions
                    ),
                    selectinload(UserDay.day),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                    selectinload(UserDay.assessments),
                )
                .order_by(UserDay.day_id, UserDay.id)
            )
            assignments = list(assignments_result.scalars().all())

            # Get all forms for this year
            forms_result = await session.execute(
                select(ApplicationForm)
                .where(ApplicationForm.year_id == year_id)
                .options(
                    selectinload(ApplicationForm.user),
                    selectinload(ApplicationForm.desired_positions),
                )
                .order_by(ApplicationForm.user_id)
            )
            forms = list(forms_result.scalars().all())

            # Get days
            days_result = await session.execute(
                select(Day).where(Day.year_id == year_id).order_by(Day.id)
            )
            days = list(days_result.scalars().all())

            # Get positions
            positions_result = await session.execute(
                select(Position).where(Position.year_id == year_id).order_by(Position.id)
            )
            positions = list(positions_result.scalars().all())

            # Get halls
            halls_result = await session.execute(
                select(Hall).where(Hall.year_id == year_id).order_by(Hall.id)
            )
            halls = list(halls_result.scalars().all())

            # Create ZIP archive
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                # 1. Users and Registration Forms CSV
                users_csv = self._create_users_forms_csv(forms)
                zip_file.writestr("01_users_and_registrations.csv", users_csv)

                # 2. Days CSV
                days_csv = self._create_days_csv(days)
                zip_file.writestr("02_days.csv", days_csv)

                # 3. Positions CSV
                positions_csv = self._create_positions_csv(positions)
                zip_file.writestr("03_positions.csv", positions_csv)

                # 4. Halls CSV
                halls_csv = self._create_halls_csv(halls)
                zip_file.writestr("04_halls.csv", halls_csv)

                # 5. Assignments CSV
                assignments_csv = self._create_assignments_csv(assignments)
                zip_file.writestr("05_assignments.csv", assignments_csv)

                # 6. Assessments CSV
                assessments_csv = self._create_assessments_csv(assignments)
                zip_file.writestr("06_assessments.csv", assessments_csv)

            zip_buffer.seek(0)
            return zip_buffer.getvalue()

    def _create_users_forms_csv(self, forms: list[ApplicationForm]) -> str:
        """Create CSV with users and their registration forms."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "User ID",
                "Last Name (RU)",
                "First Name (RU)",
                "Patronymic (RU)",
                "Last Name (EN)",
                "First Name (EN)",
                "Email",
                "Phone",
                "Telegram Username",
                "Telegram ID",
                "Gender",
                "ISU ID",
                "Is Admin",
                "ITMO Group",
                "Comments",
                "Needs Invitation",
                "Desired Positions",
                "Created At",
                "Updated At",
            ]
        )

        for form in forms:
            user = form.user
            desired_positions = ", ".join(
                [p.name for p in sorted(form.desired_positions, key=lambda x: x.id)]
            )

            writer.writerow(
                [
                    user.id,
                    user.last_name_ru,
                    user.first_name_ru,
                    user.patronymic_ru or "",
                    user.last_name_en,
                    user.first_name_en,
                    user.email or "",
                    user.phone or "",
                    user.telegram_username or "",
                    user.telegram_id or "",
                    user.gender or "",
                    user.isu_id or "",
                    "Yes" if user.is_admin else "No",
                    form.itmo_group or "",
                    form.comments or "",
                    "Yes" if form.needs_invitation else "No",
                    desired_positions,
                    form.created_at.isoformat() if hasattr(form, "created_at") else "",
                    form.updated_at.isoformat() if hasattr(form, "updated_at") else "",
                ]
            )

        return output.getvalue()

    def _create_days_csv(self, days: list[Day]) -> str:
        """Create CSV with days information."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "Day ID",
                "Day Name",
                "Information",
                "Score",
                "Mandatory",
                "Assignment Published",
                "Created At",
                "Updated At",
            ]
        )

        for day in days:
            writer.writerow(
                [
                    day.id,
                    day.name,
                    day.information or "",
                    day.score or "",
                    "Yes" if day.mandatory else "No",
                    "Yes" if day.assignment_published else "No",
                    day.created_at.isoformat() if hasattr(day, "created_at") else "",
                    day.updated_at.isoformat() if hasattr(day, "updated_at") else "",
                ]
            )

        return output.getvalue()

    def _create_positions_csv(self, positions: list[Position]) -> str:
        """Create CSV with positions information."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "Position ID",
                "Position Name",
                "Can Desire",
                "Has Halls",
                "Is Manager",
                "Created At",
                "Updated At",
            ]
        )

        for position in positions:
            writer.writerow(
                [
                    position.id,
                    position.name,
                    "Yes" if position.can_desire else "No",
                    "Yes" if position.has_halls else "No",
                    "Yes" if position.is_manager else "No",
                    position.created_at.isoformat() if hasattr(position, "created_at") else "",
                    position.updated_at.isoformat() if hasattr(position, "updated_at") else "",
                ]
            )

        return output.getvalue()

    def _create_halls_csv(self, halls: list[Hall]) -> str:
        """Create CSV with halls information."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "Hall ID",
                "Hall Name",
                "Description",
                "Created At",
                "Updated At",
            ]
        )

        for hall in halls:
            writer.writerow(
                [
                    hall.id,
                    hall.name,
                    hall.description or "",
                    hall.created_at.isoformat() if hasattr(hall, "created_at") else "",
                    hall.updated_at.isoformat() if hasattr(hall, "updated_at") else "",
                ]
            )

        return output.getvalue()

    def _create_assignments_csv(self, assignments: list[UserDay]) -> str:
        """Create CSV with assignments information."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "Assignment ID",
                "User ID",
                "User Name (RU)",
                "User Name (EN)",
                "Day ID",
                "Day Name",
                "Position ID",
                "Position Name",
                "Hall ID",
                "Hall Name",
                "Attendance",
                "Information",
                "Created At",
                "Updated At",
            ]
        )

        for user_day in assignments:
            user = user_day.application_form.user
            day = user_day.day

            writer.writerow(
                [
                    user_day.id,
                    user.id,
                    f"{user.last_name_ru} {user.first_name_ru}",
                    f"{user.first_name_en} {user.last_name_en}",
                    day.id,
                    day.name,
                    user_day.position.id,
                    user_day.position.name,
                    user_day.hall.id if user_day.hall else "",
                    user_day.hall.name if user_day.hall else "",
                    user_day.attendance.value if user_day.attendance else Attendance.UNKNOWN.value,
                    user_day.information or "",
                    user_day.created_at.isoformat() if hasattr(user_day, "created_at") else "",
                    user_day.updated_at.isoformat() if hasattr(user_day, "updated_at") else "",
                ]
            )

        return output.getvalue()

    def _create_assessments_csv(self, assignments: list[UserDay]) -> str:
        """Create CSV with all assessments."""
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "Assessment ID",
                "User Day ID",
                "User ID",
                "User Name (RU)",
                "Day ID",
                "Day Name",
                "Value",
                "Comment",
                "Created At",
                "Updated At",
            ]
        )

        for user_day in assignments:
            user = user_day.application_form.user
            for assessment in user_day.assessments:
                writer.writerow(
                    [
                        assessment.id,
                        user_day.id,
                        user.id,
                        f"{user.last_name_ru} {user.first_name_ru}",
                        user_day.day.id,
                        user_day.day.name,
                        assessment.value,
                        assessment.comment or "",
                        assessment.created_at.isoformat()
                        if hasattr(assessment, "created_at")
                        else "",
                        assessment.updated_at.isoformat()
                        if hasattr(assessment, "updated_at")
                        else "",
                    ]
                )

        return output.getvalue()

    async def export_all_users(self) -> str:
        """
        Export all users to CSV format.
        Includes: user data and participation in years.

        Returns CSV content as string.
        """
        async with self.session_scope() as session:
            # Get all users with their application forms
            users_result = await session.execute(
                select(User)
                .options(selectinload(User.application_forms).selectinload(ApplicationForm.year))
                .order_by(User.id)
            )
            users = list(users_result.scalars().all())

            # Create CSV
            output = StringIO()
            writer = csv.writer(output)

            # Write header
            writer.writerow(
                [
                    "User ID",
                    "Telegram ID",
                    "Last Name (RU)",
                    "First Name (RU)",
                    "Patronymic (RU)",
                    "Last Name (EN)",
                    "First Name (EN)",
                    "Email",
                    "Phone",
                    "Telegram Username",
                    "Gender",
                    "ISU ID",
                    "Is Admin",
                    "Participated Years",
                    "Created At",
                    "Updated At",
                ]
            )

            # Write data rows
            for user in users:
                # Get years user participated in
                participated_years = ", ".join(
                    sorted([form.year.year_name for form in user.application_forms])
                )

                writer.writerow(
                    [
                        user.id,
                        user.telegram_id or "",
                        user.last_name_ru,
                        user.first_name_ru,
                        user.patronymic_ru or "",
                        user.last_name_en,
                        user.first_name_en,
                        user.email or "",
                        user.phone or "",
                        user.telegram_username or "",
                        user.gender or "",
                        user.isu_id or "",
                        "Yes" if user.is_admin else "No",
                        participated_years,
                        user.created_at.isoformat() if hasattr(user, "created_at") else "",
                        user.updated_at.isoformat() if hasattr(user, "updated_at") else "",
                    ]
                )

            return output.getvalue()
