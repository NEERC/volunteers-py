import enum
from datetime import datetime

from pydantic import BaseModel

from volunteers.models import IdentityProvider
from volunteers.models.gender import Gender
from volunteers.schemas.base import BaseErrorResponse, BaseSuccessResponse


class TelegramLoginData(BaseModel):
    telegram_id: int
    telegram_auth_date: int
    telegram_first_name: str
    telegram_hash: str
    telegram_last_name: str | None = None
    telegram_username: str | None = None
    telegram_photo_url: str | None = None


class PendingAuthRequest(BaseModel):
    pending_token: str | None = None


class TelegramAuthRequest(TelegramLoginData, PendingAuthRequest):
    pass


class KeycloakAuthRequest(PendingAuthRequest):
    code: str
    redirect_uri: str
    code_verifier: str


class LegacyAuthRequest(PendingAuthRequest):
    email: str
    password: str


class RegistrationRequest(BaseModel):
    pending_token: str
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str

    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    gender: Gender | None = None


class CountryResponse(BaseModel):
    # ISO 3166-1 alpha-2 code, None if the country could not be determined
    country_code: str | None
    # Authentication methods available in this country
    auth_methods: list[IdentityProvider]


class KeycloakConfigResponse(BaseModel):
    authorization_endpoint: str
    client_id: str
    scope: str


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


class AuthFlowStatus(str, enum.Enum):
    SUCCESS = "success"
    # An ITMO Keycloak identity has to be linked before the authentication completes
    KEYCLOAK_REQUIRED = "keycloak_required"
    # No user is found for the verified identities, a new user can be registered
    REGISTRATION_REQUIRED = "registration_required"


class PendingIdentityResponse(BaseModel):
    provider: IdentityProvider
    display_name: str | None


class RegistrationPrefill(BaseModel):
    first_name: str | None
    last_name: str | None
    email: str | None


class AuthFlowResponse(BaseModel):
    status: AuthFlowStatus
    # Set when status is "success"
    tokens: SuccessfulLoginResponse | None = None
    # Set when status is not "success", must be passed to the next authentication step
    pending_token: str | None = None
    # Identities verified so far
    identities: list[PendingIdentityResponse] = []
    # Whether an existing user is found for the verified identities
    user_found: bool = False
    prefill: RegistrationPrefill | None = None


class IdentityResponse(BaseModel):
    id: int
    provider: IdentityProvider
    display_name: str | None
    created_at: datetime


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
