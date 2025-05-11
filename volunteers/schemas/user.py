from pydantic import BaseModel


class UserIn(BaseModel):
    telegram_id: int
    first_name: str
    is_admin: bool
    last_name: str | None
    telegram_username: str | None

    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    isu_id: int | None
    surname_ru: str | None
    surname_en: str | None
