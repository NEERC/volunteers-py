from pydantic import BaseModel


class DayIn(BaseModel):
    day_id: int


class DayOut(DayIn):
    name: str
    information: str
