from pydantic import BaseModel

from volunteers.models import Attendance, UserDay
from volunteers.models.mailing import AssignmentMode


class MailingFilter(BaseModel):
    """Conditions on a single assignment: AND between the fields, OR inside a field.

    An empty field does not restrict the assignment. Without any condition the mailing goes
    to all application forms of the year and assignments are not part of it.
    """

    day_ids: list[int] = []
    position_ids: list[int] = []
    hall_ids: list[int] = []
    # Assignments without a hall, together with `hall_ids`
    no_hall: bool = False
    attendance: list[Attendance] = []

    def is_empty(self) -> bool:
        return not (
            self.day_ids or self.position_ids or self.hall_ids or self.no_hall or self.attendance
        )

    def matches(self, user_day: UserDay) -> bool:
        if self.day_ids and user_day.day_id not in self.day_ids:
            return False
        if self.position_ids and user_day.position_id not in self.position_ids:
            return False
        if self.hall_ids or self.no_hall:
            in_hall = user_day.hall_id is not None and user_day.hall_id in self.hall_ids
            without_hall = user_day.hall_id is None and self.no_hall
            if not (in_hall or without_hall):
                return False
        return not (self.attendance and user_day.attendance not in self.attendance)


class MailingButton(BaseModel):
    # Jinja2 templates
    text: str = ""
    url: str = ""


class MailingDraft(BaseModel):
    """Editable part of a mailing."""

    title: str = ""
    template: str = ""
    buttons: list[MailingButton] = []
    filter: MailingFilter = MailingFilter()
    excluded_form_ids: list[int] = []
    assignment_mode: AssignmentMode = AssignmentMode.FIRST
