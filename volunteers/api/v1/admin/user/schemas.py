from pydantic import BaseModel

from volunteers.models.gender import Gender


class UserResponse(BaseModel):
    user_id: int
    telegram_id: int | None
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
    telegram_id: int | None = None
    gender: Gender | None
