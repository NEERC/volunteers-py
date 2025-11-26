from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddUserDayRequest(BaseModel):
    application_form_id: int
    day_id: int
    information: str
    position_id: int
    hall_id: int | None = None


class AddUserDayResponse(BaseSuccessResponse):
    user_day_id: int


class EditUserDayRequest(BaseModel):
    information: str | None = None
    position_id: int
    hall_id: int | None = None


class AssignmentItem(BaseModel):
    user_day_id: int
    application_form_id: int
    position_id: int
    hall_id: int | None


class AssignmentsResponse(BaseModel):
    assignments: list[AssignmentItem]
