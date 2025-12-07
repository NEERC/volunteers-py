"""Experience calculation constants and functions."""

from volunteers.models.attendance import Attendance

# Attendance weights for assessments calculation
ATTENDANCE_MAP = {
    Attendance.YES: 1.0,
    Attendance.LATE: 0.5,
    Attendance.NO: 0.0,
    Attendance.SICK: 0.0,
    Attendance.UNKNOWN: 0.0,
}


# Rank thresholds
RANK_THRESHOLDS = [
    (0, "Volunteer", 0.0),
    (1, "Silver Volunteer", 3.0),
    (2, "Gold Volunteer", 5.0),
    (3, "Platinum Volunteer", 7.0),
    (4, "Multi-Platinum Volunteer", 9.0),
    (5, "Sapphire Volunteer", 11.0),
    (6, "Ruby Volunteer", 13.0),
    (7, "Emerald Volunteer", 15.0),
    (8, "Diamond Volunteer", 17.0),
    (9, "Volunteer Vseya IFMO", 20.0),
]
RANK_THRESHOLDS_SORTED = sorted(RANK_THRESHOLDS, key=lambda x: x[2])


def get_rank(experience: float) -> tuple[str, int]:
    # Find the last rank that is greater than or equal to the experience
    for index, rank_name, threshold in RANK_THRESHOLDS_SORTED[::-1]:
        if experience >= threshold:
            return rank_name, index

    raise AssertionError("Could not find rank for experience")  # noqa: TRY003
