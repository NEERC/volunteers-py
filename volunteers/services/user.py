from sqlalchemy import select

from volunteers.models import User
from volunteers.services.base import BaseService


class UserService(BaseService):
    async def get_user_by_telegram_id(self, telegram_id: int) -> User | None:
        async with self.session_scope() as session:
            result = await session.execute(select(User).where(User.telegram_id == telegram_id))
            return result.scalar_one_or_none()
