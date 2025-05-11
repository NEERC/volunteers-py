from pydantic import BaseModel


class UserIn(BaseModel):
    telegram_id: int

    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    isu_id: int | None
    surname_ru: str | None
    surname_en: str | None

    is_admin: bool
