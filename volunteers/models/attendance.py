import enum


class Attendance(str, enum.Enum):
    YES = "yes"
    NO = "no"
    LATE = "late"
    SICK = "sick"
    UNKNOWN = "unknown"
