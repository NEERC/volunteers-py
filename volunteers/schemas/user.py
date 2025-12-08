from pydantic import BaseModel

from volunteers.models.gender import Gender


class UserIn(BaseModel):
    telegram_id: int

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


class UserUpdate(BaseModel):
    first_name_ru: str | None = None
    last_name_ru: str | None = None
    first_name_en: str | None = None
    last_name_en: str | None = None
    isu_id: int | None = None
    patronymic_ru: str | None = None
    phone: str | None = None
    email: str | None = None
    telegram_username: str | None = None
    gender: Gender | None = None
    is_admin: bool | None = None
    telegram_id: int | None = None
