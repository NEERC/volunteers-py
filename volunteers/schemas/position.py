from pydantic import BaseModel


class PositionIn(BaseModel):
    year_id: int
    name: str
    can_desire: bool
    has_halls: bool


class PositionEditIn(BaseModel):
    name: str | None
    can_desire: bool | None
    has_halls: bool | None


class PositionOut(PositionIn):
    position_id: int
