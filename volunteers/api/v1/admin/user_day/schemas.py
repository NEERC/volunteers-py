from pydantic import BaseModel

from volunteers.models.attendance import Attendance
from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.position import PositionOut


class AddUserDayRequest(BaseModel):
    application_form_id: int
    day_id: int
    information: str
    attendance: Attendance = Attendance.UNKNOWN
    position_id: int
    hall_id: int | None = None


class AddUserDayResponse(BaseSuccessResponse):
    user_day_id: int


class EditUserDayRequest(BaseModel):
    information: str | None = None
    attendance: Attendance | None = None
    position_id: int
    hall_id: int | None = None


class AssignmentItem(BaseModel):
    user_day_id: int
    user_id: int
    application_form_id: int
    first_name_ru: str
    last_name_ru: str
    patronymic_ru: str | None
    full_name_en: str
    isu_id: int | None
    phone: str | None
    email: str | None
    telegram_username: str | None
    itmo_group: str | None
    comments: str
    day_id: int
    day_name: str
    position: PositionOut
    hall_id: int | None
    hall_name: str | None
    information: str
    attendance: str
    created_at: str
    updated_at: str


class AssignmentsResponse(BaseModel):
    assignments: list[AssignmentItem]
