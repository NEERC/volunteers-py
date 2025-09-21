from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


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
    full_name_en: str
    itmo_group: str | None
    email: str | None
    phone: str | None
    telegram_username: str | None
    is_registered: bool


class UserListResponse(BaseModel):
    users: list[UserListItem]
