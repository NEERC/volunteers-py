from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddYearRequest(BaseModel):
    year_name: str


class AddYearResponse(BaseSuccessResponse):
    year_id: int


class EditYearRequest(BaseModel):
    year_name: str | None = None
    open_for_registration: bool | None = None
