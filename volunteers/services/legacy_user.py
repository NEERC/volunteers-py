from sqlalchemy import select
from sqlalchemy.orm import selectinload

from volunteers.models import LegacyUser

from .base import BaseService


class LegacyUserService(BaseService):
    async def get_user_by_email(self, email: str) -> LegacyUser | None:
        async with self.session_scope() as session:
            result = await session.execute(
                select(LegacyUser)
                .where(LegacyUser.email == email)
                .options(selectinload(LegacyUser.new_user))
            )
            return result.scalar_one_or_none()
