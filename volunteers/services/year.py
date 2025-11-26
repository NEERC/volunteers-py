from dataclasses import dataclass

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import selectinload

from volunteers.api.v1.admin.year.schemas import ExperienceItem
from volunteers.bot.notify import Notifier
from volunteers.models import (
    ApplicationForm,
    Assessment,
    Day,
    FormPositionAssociation,
    Hall,
    Position,
    User,
    UserDay,
    Year,
)
from volunteers.models.attendance import Attendance
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.schemas.day import DayEditIn, DayIn
from volunteers.schemas.hall import HallEditIn, HallIn
from volunteers.schemas.position import PositionEditIn, PositionIn
from volunteers.schemas.user_day import UserDayEditIn, UserDayIn
from volunteers.schemas.year import YearEditIn, YearIn

from .base import BaseService
from .errors import DomainError


class ApplicationFormNotFound(DomainError):
    """Application form not found"""

    def __init__(self) -> None:
        super().__init__("Application form not found")


class YearNotFound(DomainError):
    """Year not found"""

    def __init__(self) -> None:
        super().__init__("Year not found")


class PositionNotFound(DomainError):
    """Position not found"""


class DayNotFound(DomainError):
    """Day not found"""


class UserDayNotFound(DomainError):
    """User day not found"""


class AssessmentNotFound(DomainError):
    """Assessment not found"""


class HallNotFound(DomainError):
    """Hall not found"""


@dataclass(frozen=True)
class ManagerForYear:
    hall_id: int | None
    day_id: int


class YearService(BaseService):
    def __init__(self, notifier: Notifier) -> None:
        self.notifier = notifier
        super().__init__()

    async def get_years(self) -> list[Year]:
        async with self.session_scope() as session:
            result = await session.execute(select(Year).order_by(Year.id))
            return list(result.scalars().all())

    async def get_year_by_year_id(self, year_id: int) -> Year | None:
        async with self.session_scope() as session:
            result = await session.execute(select(Year).where(Year.id == year_id))
            return result.scalar_one_or_none()

    async def get_positions_by_year_id(self, year_id: int) -> list[Position]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(Position).where(Position.year_id == year_id).order_by(Position.id)
            )
            return list(result.scalars().all())

    async def get_days_by_year_id(self, year_id: int) -> list[Day]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(Day).where(Day.year_id == year_id).order_by(Day.id)
            )
            return list(result.scalars().all())

    async def get_day_by_id(self, day_id: int) -> Day | None:
        async with self.session_scope() as session:
            result = await session.execute(select(Day).where(Day.id == day_id))
            return result.scalar_one_or_none()

    async def get_halls_by_year_id(self, year_id: int) -> list[Hall]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(Hall).where(Hall.year_id == year_id).order_by(Hall.id)
            )
            return list(result.scalars().all())

    async def add_hall(self, hall_in: HallIn) -> Hall:
        created_hall = Hall(
            year_id=hall_in.year_id,
            name=hall_in.name,
            description=hall_in.description,
        )
        async with self.session_scope() as session:
            session.add(created_hall)
            await session.commit()
        return created_hall

    async def edit_hall_by_hall_id(self, hall_id: int, hall_edit_in: HallEditIn) -> None:
        async with self.session_scope() as session:
            existing_hall = await session.execute(select(Hall).where(Hall.id == hall_id))

            updated_hall = existing_hall.scalar_one_or_none()
            if not updated_hall:
                raise HallNotFound()

            if (name := hall_edit_in.name) is not None:
                updated_hall.name = name
            if (description := hall_edit_in.description) is not None:
                updated_hall.description = description

            await session.commit()

    async def get_form_by_year_id_and_user_id(
        self, year_id: int, user_id: int
    ) -> ApplicationForm | None:
        async with self.session_scope() as session:
            result = await session.execute(
                select(ApplicationForm)
                .where(
                    and_(
                        ApplicationForm.year_id == year_id,
                        ApplicationForm.user_id == user_id,
                    )
                )
                .options(selectinload(ApplicationForm.desired_positions))
            )
            return result.scalar_one_or_none()

    async def get_all_forms_by_year_id(self, year_id: int) -> list[ApplicationForm]:
        """Get all application forms for a specific year with user and position data."""
        async with self.session_scope() as session:
            result = await session.execute(
                select(ApplicationForm)
                .where(ApplicationForm.year_id == year_id)
                .options(
                    selectinload(ApplicationForm.user),
                    selectinload(ApplicationForm.desired_positions),
                )
                .order_by(ApplicationForm.created_at)
            )
            return list(result.scalars().all())

    async def get_all_assignments_by_year_id(self, year_id: int) -> list[UserDay]:
        """Get all user day assignments for a specific year with related data."""
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserDay)
                .join(ApplicationForm)
                .where(ApplicationForm.year_id == year_id)
                .options(
                    selectinload(UserDay.application_form).selectinload(ApplicationForm.user),
                    selectinload(UserDay.day),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                    selectinload(UserDay.assessments),
                )
                .order_by(UserDay.created_at)
            )
            return list(result.scalars().all())

    async def get_all_assignments_by_day_id(self, day_id: int) -> list[UserDay]:
        """Get all user day assignments for a specific day with related data."""
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserDay)
                .where(UserDay.day_id == day_id)
                .options(
                    selectinload(UserDay.application_form).selectinload(ApplicationForm.user),
                    selectinload(UserDay.day),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                )
                .order_by(UserDay.created_at)
            )
            return list(result.scalars().all())

    async def add_year(self, year_in: YearIn) -> Year:
        created_year = Year(
            year_name=year_in.year_name, open_for_registration=year_in.open_for_registration
        )
        async with self.session_scope() as session:
            session.add(created_year)
            await session.commit()
        return created_year

    async def edit_year_by_year_id(self, year_id: int, year_edit_in: YearEditIn) -> None:
        async with self.session_scope() as session:
            existing_year = await session.execute(select(Year).where(Year.id == year_id))

            updated_year = existing_year.scalar_one_or_none()
            if not updated_year:
                raise YearNotFound()

            if (year_name := year_edit_in.year_name) is not None:
                updated_year.year_name = year_name
            if (open_for_registration := year_edit_in.open_for_registration) is not None:
                updated_year.open_for_registration = open_for_registration

            await session.commit()

    async def get_position_by_id(self, position_id: int) -> Position | None:
        async with self.session_scope() as session:
            result = await session.execute(select(Position).where(Position.id == position_id))
            return result.scalar_one_or_none()

    async def add_position(self, position_in: PositionIn) -> Position:
        created_position = Position(
            year_id=position_in.year_id,
            name=position_in.name,
            can_desire=position_in.can_desire,
            has_halls=position_in.has_halls,
            is_manager=position_in.is_manager,
        )
        async with self.session_scope() as session:
            session.add(created_position)
            await session.commit()
        return created_position

    async def edit_position_by_position_id(
        self, position_id: int, position_edit_in: PositionEditIn
    ) -> None:
        async with self.session_scope() as session:
            existing_position = await session.execute(
                select(Position).where(Position.id == position_id)
            )

            updated_position = existing_position.scalar_one_or_none()
            if not updated_position:
                raise PositionNotFound()

            if (name := position_edit_in.name) is not None:
                updated_position.name = name
            if (can_desire := position_edit_in.can_desire) is not None:
                updated_position.can_desire = can_desire
            if (has_halls := position_edit_in.has_halls) is not None:
                updated_position.has_halls = has_halls
            if (is_manager := position_edit_in.is_manager) is not None:
                updated_position.is_manager = is_manager

            await session.commit()

    async def add_day(self, day_in: DayIn) -> Day:
        created_day = Day(
            year_id=day_in.year_id,
            name=day_in.name,
            information=day_in.information,
            score=day_in.score,
            mandatory=day_in.mandatory,
            assignment_published=day_in.assignment_published,
        )
        async with self.session_scope() as session:
            session.add(created_day)
            await session.commit()
        return created_day

    async def edit_day_by_day_id(self, day_id: int, day_edit_in: DayEditIn) -> None:
        async with self.session_scope() as session:
            existing_day = await session.execute(select(Day).where(Day.id == day_id))

            updated_day = existing_day.scalar_one_or_none()
            if not updated_day:
                raise DayNotFound()

            if (name := day_edit_in.name) is not None:
                updated_day.name = name
            if (information := day_edit_in.information) is not None:
                updated_day.information = information
            if (score := day_edit_in.score) is not None:
                updated_day.score = score
            if (mandatory := day_edit_in.mandatory) is not None:
                updated_day.mandatory = mandatory
            if (assignment_published := day_edit_in.assignment_published) is not None:
                updated_day.assignment_published = assignment_published

            await session.commit()

    async def add_user_day(self, user_day_in: UserDayIn, author: User) -> UserDay:
        created_user_day = UserDay(
            application_form_id=user_day_in.application_form_id,
            day_id=user_day_in.day_id,
            information=user_day_in.information,
            attendance=user_day_in.attendance,
            position_id=user_day_in.position_id,
            hall_id=user_day_in.hall_id,
        )
        async with self.session_scope() as session:
            session.add(created_user_day)
            await session.commit()
            day = await created_user_day.awaitable_attrs.day
            application_form = await created_user_day.awaitable_attrs.application_form
            user = await application_form.awaitable_attrs.user
            position = await created_user_day.awaitable_attrs.position
            hall = await created_user_day.awaitable_attrs.hall
            await self.notifier.notify(
                f"[{day.name}] {user.first_name_ru} {user.last_name_ru} (@{user.telegram_username}) \n(unassigned) -> {position.name} {hall.name if hall else ''}\n(by @{author.telegram_username})"
            )
        return created_user_day

    async def edit_user_day_by_user_day_id(
        self, user_day_id: int, user_day_edit_in: UserDayEditIn, author: User
    ) -> None:
        async with self.session_scope() as session:
            existing_user_day = await session.execute(
                select(UserDay).where(UserDay.id == user_day_id)
            )

            updated_user_day = existing_user_day.scalar_one_or_none()
            if not updated_user_day:
                raise UserDayNotFound()

            old_position = await updated_user_day.awaitable_attrs.position
            old_hall = await updated_user_day.awaitable_attrs.hall

            new_position = await session.get(Position, user_day_edit_in.position_id)
            if not new_position:
                raise PositionNotFound()

            if not new_position.has_halls and user_day_edit_in.hall_id:
                raise HallNotFound()

            new_hall = (
                await session.get(Hall, user_day_edit_in.hall_id)
                if user_day_edit_in.hall_id
                else None
            )

            if (information := user_day_edit_in.information) is not None:
                updated_user_day.information = information
            if (attendance := user_day_edit_in.attendance) is not None:
                updated_user_day.attendance = attendance
            updated_user_day.position = new_position
            updated_user_day.hall = new_hall
            await session.commit()

            day = await updated_user_day.awaitable_attrs.day
            application_form = await updated_user_day.awaitable_attrs.application_form
            user = await application_form.awaitable_attrs.user

            await self.notifier.notify(
                f"[{day.name}] {user.first_name_ru} {user.last_name_ru} (@{user.telegram_username})\n{old_position.name} {old_hall.name if old_hall else ''} -> {new_position.name} {new_hall.name if new_hall else ''}\n(by @{author.telegram_username})"
            )

    async def delete_user_day_by_user_day_id(self, user_day_id: int, author: User) -> None:
        """Delete a user day by its ID."""
        async with self.session_scope() as session:
            existing_user_day = await session.execute(
                select(UserDay).where(UserDay.id == user_day_id)
            )
            user_day = existing_user_day.scalar_one_or_none()
            if not user_day:
                raise UserDayNotFound()

            await session.delete(user_day)
            await session.commit()

            day = await user_day.awaitable_attrs.day
            application_form = await user_day.awaitable_attrs.application_form
            user = await application_form.awaitable_attrs.user
            position = await user_day.awaitable_attrs.position
            hall = await user_day.awaitable_attrs.hall
            await self.notifier.notify(
                f"[{day.name}] {user.first_name_ru} {user.last_name_ru} (@{user.telegram_username})\n{position.name} {hall.name if hall else ''} -> (unassigned)\n(by @{author.telegram_username})"
            )

    async def copy_assignments_from_day(
        self, source_day_id: int, target_day_id: int, overwrite_existing: bool = False
    ) -> int:
        """Copy all assignments from source day to target day.

        Args:
            source_day_id: The ID of the day to copy assignments from
            target_day_id: The ID of the day to copy assignments to
            overwrite_existing: If True, overwrite existing assignments for users who already have assignments on target day

        Returns:
            The number of assignments copied
        """
        async with self.session_scope() as session:
            # Verify both days exist
            source_day = await session.execute(select(Day).where(Day.id == source_day_id))
            source_day_obj = source_day.scalar_one_or_none()
            if not source_day_obj:
                raise DayNotFound()

            target_day = await session.execute(select(Day).where(Day.id == target_day_id))
            target_day_obj = target_day.scalar_one_or_none()
            if not target_day_obj:
                raise DayNotFound()

            # Get all assignments from source day
            source_assignments = await session.execute(
                select(UserDay)
                .where(UserDay.day_id == source_day_id)
                .options(
                    selectinload(UserDay.application_form),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                )
            )
            source_assignments_list = list(source_assignments.scalars().all())

            if not source_assignments_list:
                return 0

            # Get existing assignments for target day (to check for conflicts)
            existing_assignments = await session.execute(
                select(UserDay).where(UserDay.day_id == target_day_id)
            )
            existing_assignments_list = list(existing_assignments.scalars().all())
            existing_application_form_ids = {
                assignment.application_form_id for assignment in existing_assignments_list
            }

            copied_count = 0

            for source_assignment in source_assignments_list:
                # Check if user already has an assignment on target day
                if source_assignment.application_form_id in existing_application_form_ids:
                    if overwrite_existing:
                        # Delete existing assignment
                        existing_assignment = next(
                            (
                                a
                                for a in existing_assignments_list
                                if a.application_form_id == source_assignment.application_form_id
                            ),
                            None,
                        )
                        if existing_assignment:
                            await session.delete(existing_assignment)
                    else:
                        # Skip this assignment
                        continue

                # Create new assignment for target day
                new_assignment = UserDay(
                    application_form_id=source_assignment.application_form_id,
                    day_id=target_day_id,
                    information=source_assignment.information,
                    attendance=source_assignment.attendance,
                    position_id=source_assignment.position_id,
                    hall_id=source_assignment.hall_id,
                )
                session.add(new_assignment)
                copied_count += 1

            await session.commit()
            return copied_count

    async def add_assessment(self, assessment_in: AssessmentIn) -> Assessment:
        created_assessment = Assessment(
            user_day_id=assessment_in.user_day_id,
            comment=assessment_in.comment,
            value=assessment_in.value,
        )
        async with self.session_scope() as session:
            session.add(created_assessment)
            await session.commit()
        return created_assessment

    async def edit_assessment_by_assessment_id(
        self, assessment_id: int, assessment_edit_in: AssessmentEditIn
    ) -> None:
        async with self.session_scope() as session:
            existing_assessment = await session.execute(
                select(Assessment).where(Assessment.id == assessment_id)
            )

            updated_assessment = existing_assessment.scalar_one_or_none()
            if not updated_assessment:
                raise AssessmentNotFound()

            if (comment := assessment_edit_in.comment) is not None:
                updated_assessment.comment = comment
            if (value := assessment_edit_in.value) is not None:
                updated_assessment.value = value

            await session.commit()

    async def update_user_day_attendance(self, user_day_id: int, attendance: Attendance) -> None:
        """Update attendance for a user day."""
        async with self.session_scope() as session:
            user_day = await session.execute(select(UserDay).where(UserDay.id == user_day_id))
            user_day_obj = user_day.scalar_one_or_none()
            if not user_day_obj:
                raise UserDayNotFound()

            user_day_obj.attendance = attendance
            await session.commit()

    async def create_form(self, form: ApplicationFormIn) -> None:
        async with self.session_scope() as session:
            created_form = ApplicationForm(
                year_id=form.year_id,
                user_id=form.user_id,
                itmo_group=form.itmo_group,
                comments=form.comments,
                needs_invitation=form.needs_invitation,
            )
            session.add(created_form)
            await session.flush()

            for pos_id in form.desired_positions_ids:
                association = FormPositionAssociation(
                    form_id=created_form.id,
                    position_id=pos_id,
                    year_id=form.year_id,
                )
                session.add(association)
            await session.commit()

    async def update_form(self, form: ApplicationFormIn) -> None:
        async with self.session_scope() as session:
            existing_form = await session.execute(
                select(ApplicationForm).where(
                    and_(
                        ApplicationForm.year_id == form.year_id,
                        ApplicationForm.user_id == form.user_id,
                    )
                )
            )

            updated_form = existing_form.scalar_one_or_none()
            if not updated_form:
                raise ApplicationFormNotFound()

            updated_form.itmo_group = form.itmo_group
            updated_form.comments = form.comments
            updated_form.needs_invitation = form.needs_invitation
            await session.flush()

            # Delete existing associations
            await session.execute(
                delete(FormPositionAssociation).where(
                    FormPositionAssociation.form_id == updated_form.id
                )
            )

            # Create new associations
            for pos_id in form.desired_positions_ids:
                association = FormPositionAssociation(
                    form_id=updated_form.id,
                    position_id=pos_id,
                    year_id=form.year_id,
                )
                session.add(association)
            await session.commit()

    async def manager_for_years(self, user_id: int) -> set[int]:
        """A user is a manager for a year if they have at least one manager assignment for this year."""
        async with self.session_scope() as session:
            user_days = await session.scalars(
                select(UserDay)
                .join(ApplicationForm)
                .join(Position)
                .options(selectinload(UserDay.application_form))
                .where(
                    and_(
                        ApplicationForm.user_id == user_id,
                        Position.is_manager.is_(True),
                    )
                )
            )
            return {user_day.application_form.year_id for user_day in user_days}

    async def manager_for_year(self, user_id: int, year_id: int) -> set[ManagerForYear]:
        """Gett all days and halls that the user is manager for in a year."""
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserDay)
                .join(ApplicationForm)
                .join(Position)
                .where(
                    and_(
                        ApplicationForm.user_id == user_id,
                        ApplicationForm.year_id == year_id,
                        Position.is_manager.is_(True),
                    )
                )
            )
            return {
                ManagerForYear(hall_id=res.hall_id, day_id=res.day_id) for res in result.scalars()
            }

    async def get_user_day_by_id(self, user_day_id: int) -> UserDay | None:
        """Get a user day by ID with all relationships loaded."""
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserDay)
                .where(UserDay.id == user_day_id)
                .options(
                    selectinload(UserDay.application_form).selectinload(ApplicationForm.user),
                    selectinload(UserDay.day),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                    selectinload(UserDay.assessments),
                )
            )
            return result.scalar_one_or_none()

    async def get_user_experience(self, user_id: int) -> list[ExperienceItem]:
        """Get prior experience data for a user across all years."""
        async with self.session_scope() as session:
            # Get all user days for this user with related data
            result = await session.execute(
                select(UserDay)
                .join(ApplicationForm)
                .where(ApplicationForm.user_id == user_id)
                .options(
                    selectinload(UserDay.application_form).selectinload(ApplicationForm.year),
                    selectinload(UserDay.position),
                    selectinload(UserDay.assessments),
                )
                .order_by(ApplicationForm.year_id)
            )
            user_days = list(result.scalars().all())

            # Group by year and build experience list directly
            experience_by_year: dict[int, ExperienceItem] = {}

            for user_day in user_days:
                year_id = user_day.application_form.year_id
                year_name = user_day.application_form.year.year_name

                if year_id not in experience_by_year:
                    experience_by_year[year_id] = ExperienceItem(
                        year_name=year_name,
                        positions=[],
                        attendance_stats={},
                        assessments=[],
                    )

                # Add position if not already present
                if user_day.position.name not in experience_by_year[year_id].positions:
                    experience_by_year[year_id].positions.append(user_day.position.name)

                # Increment attendance count
                experience_by_year[year_id].attendance_stats[user_day.attendance] = (
                    experience_by_year[year_id].attendance_stats.get(user_day.attendance, 0) + 1
                )

                # Add assessment comments
                for assessment in user_day.assessments:
                    experience_by_year[year_id].assessments.append(
                        str(assessment.value) + ": " + assessment.comment
                    )

            return list(experience_by_year.values())
