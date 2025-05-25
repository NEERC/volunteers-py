from pydantic import BaseModel

from volunteers.models.attendance import Attendance


class UserDayIn(BaseModel):
    application_form_id: int
    day_id: int
    information: str
    attendance: Attendance


class UserDayEditIn(BaseModel):
    information: str | None
    attendance: Attendance | None


class UserDayOut(UserDayIn):
    user_day_id: int
