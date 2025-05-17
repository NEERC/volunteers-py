from sqlalchemy import select

from volunteers.models import User
from volunteers.schemas.user import UserIn

from .base import BaseService


class UserService(BaseService):
    async def get_user_by_telegram_id(self, telegram_id: int) -> User | None:
        async with self.session_scope() as session:
            result = await session.execute(select(User).where(User.telegram_id == telegram_id))
            return result.scalar_one_or_none()

    async def create_user(self, user_in: UserIn) -> User:
        user = User(
            telegram_id=user_in.telegram_id,
            first_name_ru=user_in.first_name_ru,
            last_name_ru=user_in.last_name_ru,
            full_name_en=user_in.full_name_en,
            isu_id=user_in.isu_id,
            patronymic_ru=user_in.patronymic_ru,
            is_admin=user_in.is_admin,
        )
        async with self.session_scope() as session:
            session.add(user)
            await session.commit()
            return user
