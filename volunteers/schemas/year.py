from pydantic import BaseModel


class YearIn(BaseModel):
    year_name: str
    open_for_registration: bool


class YearEditIn(BaseModel):
    year_name: str | None
    open_for_registration: bool | None
