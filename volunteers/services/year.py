from sqlalchemy import and_, delete, select

from volunteers.models import ApplicationForm, Day, FormPositionAssociation, Position, Year
from volunteers.schemas.application_form import ApplicationFormIn

from .base import BaseService
from .errors import DomainError


class ApplicationFormNotFound(DomainError):
    """Application form not found"""


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
                select(ApplicationForm).where(
                    and_(
                        ApplicationForm.year_id == year_id,
                        ApplicationForm.user_id == user_id,
                    )
                )
            )
            return result.scalar_one_or_none()

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
