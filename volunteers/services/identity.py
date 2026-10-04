from sqlalchemy import select
from sqlalchemy.orm import selectinload

from volunteers.models import IdentityProvider, User, UserIdentity

from .base import BaseService


class IdentityService(BaseService):
    async def get_identity(self, provider: IdentityProvider, subject: str) -> UserIdentity | None:
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserIdentity)
                .where(UserIdentity.provider == provider, UserIdentity.subject == subject)
                .options(selectinload(UserIdentity.user))
            )
            return result.scalar_one_or_none()

    async def get_user_identities(self, user_id: int) -> list[UserIdentity]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserIdentity)
                .where(UserIdentity.user_id == user_id)
                .order_by(UserIdentity.id)
            )
            return list(result.scalars().all())

    async def get_identity_by_id(self, identity_id: int) -> UserIdentity | None:
        async with self.session_scope() as session:
            result = await session.execute(
                select(UserIdentity).where(UserIdentity.id == identity_id)
            )
            return result.scalar_one_or_none()

    async def get_user_by_identity(self, provider: IdentityProvider, subject: str) -> User | None:
        identity = await self.get_identity(provider, subject)
        return identity.user if identity else None

    async def add_identity(
        self,
        user_id: int,
        provider: IdentityProvider,
        subject: str,
        display_name: str | None = None,
        secret: str | None = None,
    ) -> UserIdentity:
        identity = UserIdentity(
            user_id=user_id,
            provider=provider,
            subject=subject,
            display_name=display_name,
            secret=secret,
        )
        async with self.session_scope() as session:
            session.add(identity)
            await session.commit()
            return identity

    async def update_display_name(self, identity_id: int, display_name: str | None) -> None:
        async with self.session_scope() as session:
            identity = await session.get(UserIdentity, identity_id)
            if identity is not None and identity.display_name != display_name:
                identity.display_name = display_name
                await session.commit()

    async def delete_identity(self, identity_id: int) -> None:
        async with self.session_scope() as session:
            identity = await session.get(UserIdentity, identity_id)
            if identity is not None:
                await session.delete(identity)
                await session.commit()
