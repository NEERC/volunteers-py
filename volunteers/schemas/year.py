from pydantic import BaseModel


class YearIn(BaseModel):
    year_name: str
    open_for_registration: bool


class YearOut(YearIn):
    year_id: int
