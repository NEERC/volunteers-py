from pydantic import BaseModel


class UserIn(BaseModel):
    telegram_id: int

    first_name_ru: str
    last_name_ru: str
    full_name_en: str
    is_admin: bool

    isu_id: int | None
    patronymic_ru: str | None
