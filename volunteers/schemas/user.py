from pydantic import BaseModel


class UserIn(BaseModel):
    first_name_ru: str
    last_name_ru: str
    first_name_en: str
    last_name_en: str
    telegram_username: str
    phone_number: str
    isu_id: int | None


class UserOut(UserIn):
    pass
