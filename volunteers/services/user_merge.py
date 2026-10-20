from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from volunteers.models import (
    ApplicationForm,
    Assessment,
    ExtraExperience,
    FormPositionAssociation,
    IdentityProvider,
    User,
    UserDay,
    UserIdentity,
)
from volunteers.models.identity_provider import SINGLE_IDENTITY_PROVIDERS

from .base import BaseService
from .errors import DomainError

# Profile fields taken from the kept user, or from the merged one when empty on the kept one
MERGED_FIELDS = (
    "first_name_ru",
    "last_name_ru",
    "patronymic_ru",
    "first_name_en",
    "last_name_en",
    "isu_id",
    "phone",
    "email",
    "telegram_username",
    "gender",
)


class UserMergeError(DomainError):
    pass


class MergeUserNotFound(UserMergeError):
    def __init__(self, user_id: int) -> None:
        super().__init__(f"User {user_id} not found")


class MergeWithItself(UserMergeError):
    def __init__(self) -> None:
        super().__init__("Cannot merge a user with itself")


class UnresolvedFormConflict(UserMergeError):
    def __init__(self, year_name: str) -> None:
        super().__init__(f"Choose which application form to keep for {year_name}")


class UnresolvedIdentityConflict(UserMergeError):
    def __init__(self, provider: IdentityProvider) -> None:
        super().__init__(f"Choose which {provider.value} account to keep")


@dataclass
class FormConflict:
    year_id: int
    year_name: str
    # Forms of the kept user and of the merged user, in this order
    forms: list[ApplicationForm]


@dataclass
class IdentityConflict:
    provider: IdentityProvider
    # Identities of the kept user and of the merged user, in this order
    identities: list[UserIdentity]


@dataclass
class MergePlan:
    """Merge of two users: the older one (smaller id) is kept, the newer one is merged into it."""

    target: User
    source: User
    merged_fields: dict[str, Any]
    form_conflicts: list[FormConflict]
    identity_conflicts: list[IdentityConflict]


def _is_empty(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def merge_user_fields(target: User, source: User) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    for field in MERGED_FIELDS:
        value = getattr(target, field)
        fields[field] = getattr(source, field) if _is_empty(value) else value
    fields["is_admin"] = bool(target.is_admin or source.is_admin)
    return fields


class UserMergeService(BaseService):
    async def _load_user(self, session: AsyncSession, user_id: int) -> User:
        result = await session.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.identities),
                selectinload(User.application_forms).options(
                    selectinload(ApplicationForm.year),
                    selectinload(ApplicationForm.desired_positions),
                    selectinload(ApplicationForm.user_days).options(
                        selectinload(UserDay.day),
                        selectinload(UserDay.position),
                        selectinload(UserDay.assessments),
                    ),
                ),
            )
        )
        user = result.scalar_one_or_none()
        if user is None:
            raise MergeUserNotFound(user_id)
        return user

    async def _plan(self, session: AsyncSession, user_id: int, other_user_id: int) -> MergePlan:
        if user_id == other_user_id:
            raise MergeWithItself()
        target = await self._load_user(session, min(user_id, other_user_id))
        source = await self._load_user(session, max(user_id, other_user_id))

        source_forms = {form.year_id: form for form in source.application_forms}
        form_conflicts = [
            FormConflict(
                year_id=form.year_id,
                year_name=form.year.year_name,
                forms=[form, source_forms[form.year_id]],
            )
            for form in sorted(target.application_forms, key=lambda f: f.year_id)
            if form.year_id in source_forms
        ]

        source_identities = {
            identity.provider: identity
            for identity in source.identities
            if identity.provider in SINGLE_IDENTITY_PROVIDERS
        }
        identity_conflicts = [
            IdentityConflict(
                provider=identity.provider,
                identities=[identity, source_identities[identity.provider]],
            )
            for identity in sorted(target.identities, key=lambda i: i.id)
            if identity.provider in source_identities
        ]

        return MergePlan(
            target=target,
            source=source,
            merged_fields=merge_user_fields(target, source),
            form_conflicts=form_conflicts,
            identity_conflicts=identity_conflicts,
        )

    async def plan_merge(self, user_id: int, other_user_id: int) -> MergePlan:
        async with self.session_scope() as session:
            return await self._plan(session, user_id, other_user_id)

    async def merge(
        self,
        user_id: int,
        other_user_id: int,
        kept_form_ids: dict[int, int],
        kept_identity_ids: dict[IdentityProvider, int],
    ) -> int:
        """Merge two users, resolving conflicts with the given choices.

        `kept_form_ids` maps a year id to the id of the form to keep for every year both users
        have a form for, `kept_identity_ids` maps a provider to the id of the identity to keep
        for every provider both users have an identity of. Returns the id of the kept user.
        """
        async with self.session_scope() as session:
            plan = await self._plan(session, user_id, other_user_id)
            target_id, source_id = plan.target.id, plan.source.id

            dropped_form_ids: list[int] = []
            for form_conflict in plan.form_conflicts:
                kept = kept_form_ids.get(form_conflict.year_id)
                ids = [form.id for form in form_conflict.forms]
                if kept not in ids:
                    raise UnresolvedFormConflict(form_conflict.year_name)
                dropped_form_ids.extend(i for i in ids if i != kept)

            dropped_identity_ids: list[int] = []
            for identity_conflict in plan.identity_conflicts:
                kept = kept_identity_ids.get(identity_conflict.provider)
                ids = [identity.id for identity in identity_conflict.identities]
                if kept not in ids:
                    raise UnresolvedIdentityConflict(identity_conflict.provider)
                dropped_identity_ids.extend(i for i in ids if i != kept)

            # Everything below is done with bulk statements, loaded objects are not needed anymore
            session.expunge_all()

            if dropped_form_ids:
                dropped_user_days = select(UserDay.id).where(
                    UserDay.application_form_id.in_(dropped_form_ids)
                )
                await session.execute(
                    delete(Assessment).where(Assessment.user_day_id.in_(dropped_user_days))
                )
                await session.execute(
                    delete(UserDay).where(UserDay.application_form_id.in_(dropped_form_ids))
                )
                await session.execute(
                    delete(ExtraExperience).where(
                        ExtraExperience.application_form_id.in_(dropped_form_ids)
                    )
                )
                await session.execute(
                    delete(FormPositionAssociation).where(
                        FormPositionAssociation.form_id.in_(dropped_form_ids)
                    )
                )
                await session.execute(
                    delete(ApplicationForm).where(ApplicationForm.id.in_(dropped_form_ids))
                )
            await session.execute(
                update(ApplicationForm)
                .where(ApplicationForm.user_id == source_id)
                .values(user_id=target_id)
            )

            if dropped_identity_ids:
                await session.execute(
                    delete(UserIdentity).where(UserIdentity.id.in_(dropped_identity_ids))
                )
            await session.execute(
                update(UserIdentity)
                .where(UserIdentity.user_id == source_id)
                .values(user_id=target_id)
            )

            await session.execute(
                update(Assessment)
                .where(Assessment.author_id == source_id)
                .values(author_id=target_id)
            )

            await session.execute(delete(User).where(User.id == source_id))
            await session.execute(
                update(User).where(User.id == target_id).values(**plan.merged_fields)
            )

            await session.commit()
            self.logger.info(
                f"User {source_id} merged into {target_id}, "
                f"dropped forms {dropped_form_ids}, identities {dropped_identity_ids}"
            )
            return target_id
