from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddPositionRequest(BaseModel):
    year_id: int
    name: str
    can_desire: bool = False
    has_halls: bool = False


class AddPositionResponse(BaseSuccessResponse):
    position_id: int


class EditPositionRequest(BaseModel):
    name: str | None = None
    can_desire: bool | None = None
    has_halls: bool | None = None
