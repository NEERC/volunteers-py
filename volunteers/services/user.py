from sqlalchemy import select

from volunteers.models import ApplicationForm, User
from volunteers.schemas.user import UserIn, UserUpdate

from .base import BaseService


class UserService(BaseService):
    async def get_user_by_id(self, id: int) -> User | None:
        async with self.session_scope() as session:
            result = await session.execute(select(User).where(User.id == id))
            return result.scalar_one_or_none()

    async def get_all_users(self) -> list[User]:
        async with self.session_scope() as session:
            result = await session.execute(select(User).order_by(User.id))
            return list(result.scalars().all())

    async def create_user(self, user_in: UserIn) -> User:
        user = User(
            first_name_ru=user_in.first_name_ru,
            last_name_ru=user_in.last_name_ru,
            first_name_en=user_in.first_name_en,
            last_name_en=user_in.last_name_en,
            isu_id=user_in.isu_id,
            patronymic_ru=user_in.patronymic_ru,
            phone=user_in.phone,
            email=user_in.email,
            telegram_username=user_in.telegram_username,
            gender=user_in.gender,
            is_admin=user_in.is_admin,
        )
        async with self.session_scope() as session:
            session.add(user)
            await session.commit()
            return user

    async def update_user(self, user_id: int, user_update: UserUpdate) -> User | None:
        async with self.session_scope() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

            if not user:
                return None
            if user_update.is_admin is not None:
                user.is_admin = user_update.is_admin
            if user_update.first_name_ru is not None:
                user.first_name_ru = user_update.first_name_ru
            if user_update.last_name_ru is not None:
                user.last_name_ru = user_update.last_name_ru
            if user_update.first_name_en is not None:
                user.first_name_en = user_update.first_name_en
            if user_update.last_name_en is not None:
                user.last_name_en = user_update.last_name_en
            if user_update.isu_id is not None:
                user.isu_id = user_update.isu_id
            if user_update.patronymic_ru is not None:
                user.patronymic_ru = user_update.patronymic_ru
            if user_update.phone is not None:
                user.phone = user_update.phone
            if user_update.email is not None:
                user.email = user_update.email
            if user_update.telegram_username is not None:
                user.telegram_username = user_update.telegram_username
            if user_update.gender is not None:
                user.gender = user_update.gender

            await session.commit()
            return user

    async def get_users_with_registration_status(
        self, year_id: int
    ) -> list[tuple[User, bool, str | None, bool]]:
        """
        Get all users with their registration status for a specific year.
        Returns a list of tuples: (user, is_registered, itmo_group, cancelled)
        """
        async with self.session_scope() as session:
            result = await session.execute(
                select(User, ApplicationForm)
                .outerjoin(
                    ApplicationForm,
                    (ApplicationForm.user_id == User.id) & (ApplicationForm.year_id == year_id),
                )
                .order_by(User.id)
            )
            return [
                (
                    user,
                    form is not None,
                    form.extras.itmo_group if form else None,
                    form.cancelled if form else False,
                )
                for user, form in result.tuples()
            ]
