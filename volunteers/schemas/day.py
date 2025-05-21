from pydantic import BaseModel


class DayIn(BaseModel):
    year_id: int
    name: str
    information: str


class DayEditIn(BaseModel):
    name: str | None
    information: str | None


class DayOut(DayIn):
    day_id: int
