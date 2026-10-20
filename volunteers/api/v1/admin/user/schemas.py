from datetime import datetime

from pydantic import BaseModel

from volunteers.models import IdentityProvider
from volunteers.models.gender import Gender


class UserIdentityResponse(BaseModel):
    id: int
    provider: IdentityProvider
    subject: str
    display_name: str | None
    created_at: datetime


class UserResponse(BaseModel):
    user_id: int
    first_name_ru: str
    last_name_ru: str
    patronymic_ru: str | None
    first_name_en: str
    last_name_en: str
    isu_id: int | None
    phone: str | None
    email: str | None
    telegram_username: str | None
    is_admin: bool
    gender: Gender | None
    # Only filled when a single user is requested
    identities: list[UserIdentityResponse] | None = None


class AllUsersResponse(BaseModel):
    users: list[UserResponse]


class EditUserRequest(BaseModel):
    first_name_ru: str | None = None
    last_name_ru: str | None = None
    first_name_en: str | None = None
    last_name_en: str | None = None
    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    telegram_username: str | None = None
    is_admin: bool | None = None
    gender: Gender | None


class MergeFormDay(BaseModel):
    day_name: str
    position_name: str
    assessments_count: int


class MergeFormSummary(BaseModel):
    form_id: int
    user_id: int
    itmo_group: str | None
    comments: str
    created_at: datetime
    desired_positions: list[str]
    days: list[MergeFormDay]


class MergeFormConflict(BaseModel):
    year_id: int
    year_name: str
    forms: list[MergeFormSummary]


class MergeIdentityConflict(BaseModel):
    provider: IdentityProvider
    identities: list[UserIdentityResponse]


class MergePreviewResponse(BaseModel):
    # The older user (smaller id) is kept, the newer one is merged into it and deleted
    target: UserResponse
    source: UserResponse
    merged: UserResponse
    form_conflicts: list[MergeFormConflict]
    identity_conflicts: list[MergeIdentityConflict]


class MergeUsersRequest(BaseModel):
    # Year id -> id of the application form to keep, for every form conflict
    kept_form_ids: dict[int, int] = {}
    # Provider -> id of the identity to keep, for every identity conflict
    kept_identity_ids: dict[IdentityProvider, int] = {}
