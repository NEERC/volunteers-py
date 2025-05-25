from pydantic import BaseModel

from volunteers.models.attendance import Attendance
from volunteers.schemas.base import BaseSuccessResponse


class AddUserDayRequest(BaseModel):
    application_form_id: int
    day_id: int
    information: str
    attendance: Attendance = Attendance.UNKNOWN


class AddUserDayResponse(BaseSuccessResponse):
    user_day_id: int


class EditUserDayRequest(BaseModel):
    information: str | None = None
    attendance: Attendance | None = None
