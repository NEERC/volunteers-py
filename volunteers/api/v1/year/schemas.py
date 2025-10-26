from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.day import DayOutUser
from volunteers.schemas.day_assignment import DayAssignmentItem
from volunteers.schemas.position import PositionOut
from volunteers.schemas.year import YearOut


class ApplicationFormYearSavedResponse(BaseSuccessResponse):
    positions: list[PositionOut]
    days: list[DayOutUser]
    desired_positions: list[PositionOut]
    itmo_group: str | None = ""
    comments: str = ""
    open_for_registration: bool


class ApplicationFormYearSaveRequest(BaseModel):
    desired_positions_ids: set[int]
    itmo_group: str | None = None
    comments: str = ""


class YearsResponse(BaseSuccessResponse):
    years: list[YearOut]


class DayAssignmentsResponse(BaseModel):
    """Response containing a plain array of day assignments"""

    assignments: list[DayAssignmentItem]
    is_published: bool
