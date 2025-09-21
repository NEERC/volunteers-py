from sqlalchemy import and_, delete, select
from sqlalchemy.orm import selectinload

from volunteers.models import (
    ApplicationForm,
    Assessment,
    Day,
    FormPositionAssociation,
    Position,
    UserDay,
    Year,
)
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.schemas.day import DayEditIn, DayIn
from volunteers.schemas.position import PositionEditIn, PositionIn
from volunteers.schemas.user_day import UserDayEditIn, UserDayIn
from volunteers.schemas.year import YearEditIn, YearIn

from .base import BaseService
from .errors import DomainError


class ApplicationFormNotFound(DomainError):
    """Application form not found"""


class YearNotFound(DomainError):
    """Year not found"""


class PositionNotFound(DomainError):
    """Position not found"""


class DayNotFound(DomainError):
    """Day not found"""


class UserDayNotFound(DomainError):
    """User day not found"""


class AssessmentNotFound(DomainError):
    """Assessment not found"""


class YearService(BaseService):
    async def get_years(self) -> list[Year]:
        async with self.session_scope() as session:
            result = await session.execute(select(Year))
            return list(result.scalars().all())

    async def get_year_by_year_id(self, year_id: int) -> Year | None:
        async with self.session_scope() as session:
            result = await session.execute(select(Year).where(Year.id == year_id))
            return result.scalar_one_or_none()

    async def get_positions_by_year_id(self, year_id: int) -> set[Position]:
        async with self.session_scope() as session:
            result = await session.execute(select(Position).where(Position.year_id == year_id))
            return set(result.scalars().all())

    async def get_days_by_year_id(self, year_id: int) -> set[Day]:
        async with self.session_scope() as session:
            result = await session.execute(select(Day).where(Day.year_id == year_id))
            return set(result.scalars().all())

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

    async def add_position(self, position_in: PositionIn) -> Position:
        created_position = Position(
            year_id=position_in.year_id, name=position_in.name, can_desire=position_in.can_desire
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
            updated_position.can_desire = position_edit_in.can_desire

            await session.commit()

    async def add_day(self, day_in: DayIn) -> Day:
        created_day = Day(year_id=day_in.year_id, name=day_in.name, information=day_in.information)
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

            await session.commit()

    async def add_user_day(self, user_day_in: UserDayIn) -> UserDay:
        created_user_day = UserDay(
            application_form_id=user_day_in.application_form_id,
            day_id=user_day_in.day_id,
            information=user_day_in.information,
            attendance=user_day_in.attendance,
        )
        async with self.session_scope() as session:
            session.add(created_user_day)
            await session.commit()
        return created_user_day

    async def edit_user_day_by_user_day_id(
        self, user_day_id: int, user_day_edit_in: UserDayEditIn
    ) -> None:
        async with self.session_scope() as session:
            existing_user_day = await session.execute(
                select(UserDay).where(UserDay.id == user_day_id)
            )

            updated_user_day = existing_user_day.scalar_one_or_none()
            if not updated_user_day:
                raise UserDayNotFound()

            if (information := user_day_edit_in.information) is not None:
                updated_user_day.information = information
            if (attendance := user_day_edit_in.attendance) is not None:
                updated_user_day.attendance = attendance

            await session.commit()

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

    async def create_form(self, form: ApplicationFormIn) -> None:
        async with self.session_scope() as session:
            created_form = ApplicationForm(
                year_id=form.year_id,
                user_id=form.user_id,
                itmo_group=form.itmo_group,
                comments=form.comments,
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
