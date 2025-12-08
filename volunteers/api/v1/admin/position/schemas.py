from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddPositionRequest(BaseModel):
    year_id: int
    name: str
    can_desire: bool = False
    has_halls: bool = False
    is_manager: bool = False
    save_for_next_year: bool = False
    score: float = 1.0
    description: str | None = None


class AddPositionResponse(BaseSuccessResponse):
    position_id: int


class EditPositionRequest(BaseModel):
    name: str | None = None
    can_desire: bool | None = None
    has_halls: bool | None = None
    is_manager: bool | None = None
    save_for_next_year: bool | None = None
    score: float | None = None
    description: str | None = None
