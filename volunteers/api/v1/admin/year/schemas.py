from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddYearRequest(BaseModel):
    year_name: str


class AddYearResponse(BaseSuccessResponse):
    year_id: int
