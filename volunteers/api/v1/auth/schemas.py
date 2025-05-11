from pydantic import BaseModel

from volunteers.schemas.base import BaseErrorResponse, BaseSuccessResponse


class TelegramLoginRequest(BaseModel):
    telegram_id: int
    auth_date: int
    first_name: str
    hash: str
    last_name: str | None
    username: str | None
    photo_url: str | None


class RegistrationRequest(TelegramLoginRequest):
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    isu_id: int | None
    surname_ru: str | None
    surname_en: str | None


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
    surname_ru: str | None
    surname_en: str | None
