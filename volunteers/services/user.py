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
            first_name=user_in.first_name,
            is_admin=user_in.is_admin,
            last_name=user_in.last_name,
            telegram_username=user_in.telegram_username,
        )
        async with self.session_scope() as session:
            session.add(user)
            await session.commit()
            return user
