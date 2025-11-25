from pydantic import BaseModel

from volunteers.models.attendance import Attendance
from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.position import PositionOut


class AddYearRequest(BaseModel):
    year_name: str


class AddYearResponse(BaseSuccessResponse):
    year_id: int


class EditYearRequest(BaseModel):
    year_name: str | None = None
    open_for_registration: bool | None = None


class UserListItem(BaseModel):
    id: int
    first_name_ru: str
    last_name_ru: str
    patronymic_ru: str | None
    first_name_en: str
    last_name_en: str
    itmo_group: str | None
    email: str | None
    phone: str | None
    telegram_username: str | None
    is_registered: bool


class UserListResponse(BaseModel):
    users: list[UserListItem]


class ExperienceItem(BaseModel):
    year_name: str
    positions: list[str]
    attendance_stats: dict[Attendance, int]
    assessments: list[str]


class RegistrationFormItem(BaseModel):
    form_id: int
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
    itmo_group: str | None
    comments: str
    needs_invitation: bool
    desired_positions: list[PositionOut]  # TODO: change to list[str]
    experience: list[ExperienceItem]
    created_at: str
    updated_at: str


class RegistrationFormsResponse(BaseModel):
    forms: list[RegistrationFormItem]
