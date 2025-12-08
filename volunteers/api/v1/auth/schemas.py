from pydantic import BaseModel

from volunteers.models.gender import Gender
from volunteers.schemas.base import BaseErrorResponse, BaseSuccessResponse


class TelegramLoginRequest(BaseModel):
    telegram_id: int
    telegram_auth_date: int
    telegram_first_name: str
    telegram_hash: str
    telegram_last_name: str | None = None
    telegram_username: str | None = None
    telegram_photo_url: str | None = None


class TelegramMigrateRequest(TelegramLoginRequest):
    telegram_id: int
    email: str
    password: str


class RegistrationRequest(TelegramLoginRequest):
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str

    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    gender: Gender | None = None


class UserUpdateRequest(BaseModel):
    first_name_ru: str | None = None
    last_name_ru: str | None = None
    first_name_en: str | None = None
    last_name_en: str | None = None
    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    gender: Gender | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SuccessfulLoginResponse(BaseSuccessResponse):
    token: str
    refresh_token: str
    expires_in: int
    refresh_expires_in: int


class ErrorLoginResponse(BaseErrorResponse):
    pass


class UserResponse(BaseModel):
    user_id: int
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    is_admin: bool

    isu_id: int | None
    patronymic_ru: str | None
    phone: str | None
    email: str | None
    telegram_username: str | None
    gender: Gender | None
