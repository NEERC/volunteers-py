from pydantic import BaseModel, Field

from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.user import UserIn, UserOut


class ApplicationFormPosition(BaseModel):
    position_id: int
    name: str


class ApplicationFormYearSavedResponse(BaseSuccessResponse):
    user_info: UserOut
    positions: set[ApplicationFormPosition]
    desired_positions: set[ApplicationFormPosition] = Field(set())
    itmo_group: str | None = ""
    comments: str = ""


class ApplicationFormYearSaveRequest(BaseModel):
    new_user_info: UserIn
    desired_positions: set[ApplicationFormPosition]
    itmo_group: str | None
    comments: str = ""
