from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddPositionRequest(BaseModel):
    year_id: int
    name: str


class AddPositionResponse(BaseSuccessResponse):
    position_id: int


class EditPositionRequest(BaseModel):
    name: str | None = None
