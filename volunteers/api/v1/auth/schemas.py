from pydantic import BaseModel

from volunteers.schemas.base import BaseErrorResponse, BaseSuccessResponse


class TelegramLoginRequest(BaseModel):
    auth_date: int
    first_name: str
    last_name: str
    username: str
    id: int
    hash: str


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
    username: str
    first_name: str
    last_name: str
    is_admin: bool
