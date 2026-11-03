import enum

from pydantic import BaseModel


class ConfirmationState(str, enum.Enum):
    """Whether the user can confirm their assignment on a day"""

    ASSIGNED = "assigned"
    NOT_ASSIGNED = "not_assigned"
    NOT_PUBLISHED = "not_published"


class DayAssignmentItem(BaseModel):
    """Simplified day assignment item for user-facing API"""

    name: str
    telegram: str | None
    position: str
    hall: str | None
    # Whether the volunteer confirmed they will come, only for admins and managers of the hall
    confirmed: bool | None = None
