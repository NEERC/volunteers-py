from pydantic import BaseModel

from volunteers.models.attendance import Attendance


class Assessment(BaseModel):
    comment: str
    value: float


class SaveDayAttendanceRequest(BaseModel):
    user_day_id: int
    attendance: Attendance
    assessment: Assessment | None
