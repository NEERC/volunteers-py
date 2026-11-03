import enum


class Attendance(str, enum.Enum):
    YES = "yes"
    NO = "no"
    LATE = "late"
    SICK = "sick"
    UNKNOWN = "unknown"
    # The volunteer promised to come, before the day; not an attendance yet
    CONFIRMED = "confirmed"
