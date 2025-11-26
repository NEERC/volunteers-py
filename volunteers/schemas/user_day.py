from pydantic import BaseModel

from volunteers.models.attendance import Attendance


class UserDayIn(BaseModel):
    application_form_id: int
    day_id: int
    information: str
    attendance: Attendance  # Required for model creation, but managed via attendance API
    position_id: int | None = None
    hall_id: int | None = None


class UserDayEditIn(BaseModel):
    information: str | None
    attendance: Attendance | None  # Optional, attendance managed via attendance API
    position_id: int
    hall_id: int | None


class UserDayOut(UserDayIn):
    user_day_id: int
