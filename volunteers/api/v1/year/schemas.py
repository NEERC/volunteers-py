from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.day import DayOut
from volunteers.schemas.position import PositionOut
from volunteers.schemas.year import YearOut


class ApplicationFormYearSavedResponse(BaseSuccessResponse):
    positions: list[PositionOut]
    days: list[DayOut]
    desired_positions: list[PositionOut]
    itmo_group: str | None = ""
    comments: str = ""


class ApplicationFormYearSaveRequest(BaseModel):
    desired_positions_ids: set[int]
    itmo_group: str | None
    comments: str = ""


class YearsResponse(BaseSuccessResponse):
    years: list[YearOut]
