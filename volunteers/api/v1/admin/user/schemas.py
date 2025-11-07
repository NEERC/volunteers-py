from pydantic import BaseModel


class UserResponse(BaseModel):
    user_id: int
    telegram_id: int | None
    first_name_ru: str
    last_name_ru: str
    patronymic_ru: str | None
    full_name_en: str
    isu_id: int | None
    phone: str | None
    email: str | None
    telegram_username: str | None
    is_admin: bool


class AllUsersResponse(BaseModel):
    users: list[UserResponse]


class EditUserRequest(BaseModel):
    first_name_ru: str | None = None
    last_name_ru: str | None = None
    full_name_en: str | None = None
    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    telegram_username: str | None = None
    is_admin: bool | None = None
    telegram_id: int | None = None
