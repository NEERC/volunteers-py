from pydantic import BaseModel


class DayIn(BaseModel):
    year_id: int
    name: str
    information: str
    score: float
    mandatory: bool


class DayEditIn(BaseModel):
    name: str | None
    information: str | None
    score: float | None
    mandatory: bool | None


class DayOutUser(BaseModel):
    day_id: int
    name: str


class DayOutAdmin(BaseModel):
    day_id: int
    year_id: int
    name: str
    information: str
    score: float | None
    mandatory: bool
