from pydantic import BaseModel


class PositionIn(BaseModel):
    year_id: int
    name: str
    can_desire: bool
    has_halls: bool
    is_manager: bool
    save_for_next_year: bool = False
    score: float = 1.0
    description: str | None = None


class PositionEditIn(BaseModel):
    name: str | None
    can_desire: bool | None
    has_halls: bool | None
    is_manager: bool | None
    save_for_next_year: bool | None = None
    score: float | None = None
    description: str | None = None


class PositionOut(PositionIn):
    position_id: int
