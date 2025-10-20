from pydantic import BaseModel


class DayAssignmentItem(BaseModel):
    """Simplified day assignment item for user-facing API"""

    name: str
    telegram: str | None
    position: str
    hall: str | None
    # attendance: Attendance
