from pydantic import BaseModel


class PositionIn(BaseModel):
    year_id: int
    name: str


class PositionEditIn(BaseModel):
    name: str | None


class PositionOut(PositionIn):
    position_id: int
