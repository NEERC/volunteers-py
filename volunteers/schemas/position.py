from pydantic import BaseModel


class PositionIn(BaseModel):
    year_id: int
    name: str
    can_desire: bool
    has_halls: bool
    is_manager: bool


class PositionEditIn(BaseModel):
    name: str | None
    can_desire: bool | None
    has_halls: bool | None
    is_manager: bool | None


class PositionOut(PositionIn):
    position_id: int
