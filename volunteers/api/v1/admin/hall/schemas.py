from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddHallRequest(BaseModel):
    year_id: int
    name: str
    description: str | None = None


class AddHallResponse(BaseSuccessResponse):
    hall_id: int


class EditHallRequest(BaseModel):
    name: str | None = None
    description: str | None = None
