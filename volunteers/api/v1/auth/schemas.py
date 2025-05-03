from pydantic import BaseModel

from volunteers.schemas.base import BaseErrorResponse, BaseSuccessResponse


class TelegramLoginRequest(BaseModel):
    id: int
    auth_date: int
    first_name: str
    hash: str
    last_name: str | None
    username: str | None
    photo_url: str | None


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
    id: int
    # username: str
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    is_admin: bool
