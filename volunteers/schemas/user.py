from pydantic import BaseModel


class UserIn(BaseModel):
    telegram_id: int
    first_name: str
    is_admin: bool
    last_name: str | None
    telegram_username: str | None
