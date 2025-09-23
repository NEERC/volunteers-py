from pydantic import BaseModel


class HallIn(BaseModel):
    year_id: int
    name: str
    description: str | None = None


class HallEditIn(BaseModel):
    name: str | None = None
    description: str | None = None


class HallOut(HallIn):
    hall_id: int
