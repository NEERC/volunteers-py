from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddDayRequest(BaseModel):
    year_id: int
    name: str
    information: str


class AddDayResponse(BaseSuccessResponse):
    day_id: int


class EditDayRequest(BaseModel):
    name: str | None = None
    information: str | None = None
