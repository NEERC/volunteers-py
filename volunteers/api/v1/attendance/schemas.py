from pydantic import BaseModel

from volunteers.models.attendance import Attendance


class SaveDayAttendanceRequest(BaseModel):
    user_day_id: int
    attendance: Attendance


class AssessmentInAttendance(BaseModel):
    assessment_id: int
    comment: str
    value: float


class AttendanceItem(BaseModel):
    user_day_id: int
    day_id: int
    day_name: str
    user_id: int
    user_name: str
    user_telegram: str | None
    position_id: int
    position_name: str
    hall_id: int | None
    hall_name: str | None
    attendance: Attendance
    assessments: list[AssessmentInAttendance]


class AllAttendanceResponse(BaseModel):
    attendance: list[AttendanceItem]
