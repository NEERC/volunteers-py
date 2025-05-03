from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.position import PositionIn, PositionOut


class ApplicationFormYearSavedResponse(BaseSuccessResponse):
    positions: list[PositionOut]
    desired_positions: list[PositionOut]
    itmo_group: str | None = ""
    comments: str = ""


class ApplicationFormYearSaveRequest(BaseModel):
    desired_positions: set[PositionIn]
    itmo_group: str | None
    comments: str = ""
