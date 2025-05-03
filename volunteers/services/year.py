from sqlalchemy import delete, insert, select, update

from volunteers.models import ApplicationForm, FormPositionAssociation, Position, Year
from volunteers.schemas.application_form import ApplicationFormIn
from volunteers.services.base import BaseService


class YearService(BaseService):
    async def get_year_by_year_id(self, year_id: int) -> Year | None:
        async with self.session_scope() as session:
            result = await session.execute(select(Year).where(Year.id == year_id))
            return result.scalar_one_or_none()

    async def get_positions_by_year_id(self, year_id: int) -> set[Position]:
        async with self.session_scope() as session:
            result = await session.execute(select(Position).where(Position.year_id == year_id))
            return set(result.scalars().all())

    async def get_form_by_year_id_and_user_id(
        self, year_id: int, user_id: int
    ) -> ApplicationForm | None:
        async with self.session_scope() as session:
            result = await session.execute(
                select(ApplicationForm).where(
                    ApplicationForm.year_id == year_id and ApplicationForm.user_id == user_id
                )
            )
            return result.scalar_one_or_none()

    async def create_form(self, form: ApplicationFormIn) -> None:
        async with self.session_scope() as session:
            result = await session.execute(
                insert(ApplicationForm)
                .values(
                    year_id=form.year_id,
                    user_id=form.user_id,
                    itmo_group=form.itmo_group,
                    comments=form.comments,
                )
                .returning(ApplicationForm)
            )

            if created_form := result.scalar_one_or_none():
                for pos in form.desired_positions:
                    await session.execute(
                        insert(FormPositionAssociation).values(
                            form_id=created_form.id,
                            position_id=pos.position_id,
                        )
                    )
            else:
                # TODO:
                pass

    async def update_form(self, form: ApplicationFormIn) -> None:
        async with self.session_scope() as session:
            result = await session.execute(
                update(ApplicationForm)
                .where(
                    ApplicationForm.year_id == form.year_id
                    and ApplicationForm.user_id == form.user_id
                )
                .values(
                    year_id=form.year_id,
                    user_id=form.user_id,
                    itmo_group=form.itmo_group,
                    comments=form.comments,
                )
                .returning(ApplicationForm)
            )

            if updated_form := result.scalar_one_or_none():
                await session.execute(
                    delete(FormPositionAssociation).where(
                        FormPositionAssociation.form_id == updated_form.id
                    )
                )

                for pos in form.desired_positions:
                    await session.execute(
                        insert(FormPositionAssociation).values(
                            form_id=updated_form.id,
                            position_id=pos.position_id,
                        )
                    )
            else:
                # TODO:
                pass
