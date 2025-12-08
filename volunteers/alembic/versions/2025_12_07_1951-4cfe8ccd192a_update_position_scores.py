"""update_position_scores

Revision ID: 4cfe8ccd192a
Revises: d8ff83645346
Create Date: 2025-12-07 19:51:31.672078

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4cfe8ccd192a"
down_revision: str | None = "d8ff83645346"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

old_data = [
    "0.0\t3\tReserve",
    "2.0\t3\tHall Manager",
    "1.0\t3\tVolunteer",
    "1.5\t3\tDeputy Hall Manager",
    "1.5\t3\tPress",
    "1.5\t3\tRegistration",
    "1.0\t3\tCoach Room Volunteer",
    "1.5\t3\tCoach Room Manager",
    "1.0\t3\tCeremonies",
    "2.0\t3\tTC Assistant",
    "0.0\t3\tCeremonies Manager",
    "0.0\t3\tRegistration Manager",
    "0.0\t3\tNot Assigned",
    "0.0\t3\tHQ",
    "0.0\t3\tPress Manager",
    "0.0\t4\tReserve",
    "0.0\t3\tDirector of Operations",
    "0.0\t3\tTechnical Committee",
    "0.0\t5\tReserve",
    "2.0\t5\tHall Manager",
    "1.0\t5\tHall Volunteer",
    "1.5\t5\tDeputy Hall Manager",
    "1.5\t5\tPress",
    "1.5\t5\tRegistration",
    "1.0\t5\tEntertainment Volunteer",
    "1.5\t5\tDeputy Entertainment Manager",
    "2.0\t5\tTC Assistant",
    "0.0\t5\tEntertainment Manager",
    "0.0\t5\tRegistration Manager",
    "0.0\t5\tNot Assigned",
    "0.0\t5\tHQ",
    "0.0\t5\tPress Manager",
    "0.0\t5\tDirector of Operations",
    "0.0\t5\tTechnical Committee",
    "2.0\t5\tBalloon Manager",
    "1.0\t5\tBalloon Volunteer",
    "0.0\t5\tICPC Executive Director",
    "0.0\t5\tICPC Deputy Executive Director",
    "0.0\t5\tICPC Operations",
    "0.0\t6\tReserve",
    "2.0\t6\tHall Manager",
    "1.5\t6\tDeputy Hall Manager",
    "1.0\t6\tHall Volunteer",
    "1.5\t6\tPress",
    "1.5\t6\tRegistration",
    "1.0\t6\tEntertainment Volunteer",
    "2.0\t6\tTC Assistant",
    "0.0\t6\tEntertainment Manager",
    "0.0\t6\tRegistration Manager",
    "0.0\t6\tPress Manager",
    "0.0\t6\tDirector of Operations",
    "0.0\t6\tTechnical Committee",
    "1.5\t5\tDeputy Entertainment Manager",
    "0.0\t7\tReserve",
    "2.0\t7\tHall Manager",
    "1.5\t7\tDeputy Hall Manager",
    "0.25\t7\tHall Volunteer",
    "1.5\t7\tPress",
    "1.5\t7\tRegistration",
    "1.0\t7\tEntertainment Volunteer",
    "0.5\t7\tTC Assistant",
    "0.0\t7\tz_Cancelled",
    "0.0\t6\tVolunteer Manager",
    "0.0\t6\tz_Cancelled",
    "0.0\t6\tSystem Administrator",
    "0.0\t6\tContest Director",
    "0.0\t6\tPCMS Manager",
    "0.0\t6\tBalloon Manager",
    "1.0\t6\tBalloon Volunteer",
    "0.0\t8\tContest Director",
    "1.0\t8\tBalloon Volunteer",
    "0.0\t8\tEntertainment Manager",
    "1.0\t8\tEntertainment Volunteer",
    "2.0\t8\tTC Assistant",
    "1.5\t8\tRegistration",
    "0.0\t8\tDirector of Operations",
    "0.0\t8\tz_Cancelled",
    "0.0\t8\tRegistration Manager",
    "0.0\t8\tBalloon Manager",
    "0.0\t8\tPress Manager",
    "0.0\t8\tSystem Administrator",
    "0.0\t8\tPCMS Manager",
    "1.5\t8\tPress",
    "0.0\t8\tTechnical Committee",
    "2.0\t8\tHall Manager",
    "0.0\t8\tVolunteer Manager",
    "1.0\t8\tHall Volunteer",
    "1.5\t8\tDeputy Hall Manager",
    "0.0\t8\tReserve",
    "1.0\t8\tSpace Volunteer",
    "2.0\t8\tTechnical Specialist",
    "0.0\t8\tExecutive Director, ICPC NERC Headquarters",
    "0.0\t9\tRegistration Manager",
    "0.0\t9\tBalloon Manager",
    "0.0\t9\tz_Cancelled",
    "2.0\t9\tHall Manager",
    "0.0\t9\tExecutive Director, ICPC NERC Headquarters",
    "2.0\t9\tTC Assistant",
    "1.0\t9\tHall Volunteer",
    "1.5\t9\tDeputy Hall Manager",
    "0.0\t9\tSystem Administrator",
    "1.5\t9\tPress",
    "1.0\t9\tEntertainment Volunteer",
    "0.0\t9\tVolunteer Manager",
    "2.0\t9\tTechnical Specialist",
    "0.0\t9\tTechnical Committee",
    "1.0\t9\tSpace Volunteer",
    "0.0\t9\tEntertainment Manager",
    "0.0\t9\tContest Director",
    "0.0\t9\tDirector of Operations",
    "1.0\t9\tBalloon Volunteer",
    "1.5\t9\tRegistration",
    "0.0\t9\tPress Manager",
    "0.0\t9\tPCMS Manager",
    "0.0\t9\tReserve",
    # "0.0\t1\tReserve",
    "1.5\t9\tLive Volunteer",
    "2.0\t9\tDeputy Registration Manager",
    "2.0\t9\tProgrammer Volunteer",
    "1.0\t11\tHall Volunteer",
    "0.0\t11\tSystem Administrator",
    "2.0\t11\tTC Assistant",
    "0.0\t11\tRegistration Manager",
    "2.0\t11\tDeputy Registration Manager",
    "0.0\t11\tExecutive Director, ICPC NERC Headquarters",
    "0.0\t11\tContest Director",
    "1.5\t11\tLive Volunteer",
    "2.0\t11\tTechnical Specialist",
    "0.0\t11\tEntertainment Manager",
    "0.0\t11\tTechnical Committee",
    "0.0\t11\tz_Cancelled",
    "0.0\t11\tBalloon Manager",
    "2.0\t11\tHall Manager",
    "0.0\t11\tPress Manager",
    "0.0\t11\tPCMS Manager",
    "2.0\t11\tProgrammer Volunteer",
    "0.0\t11\tDirector of Operations",
    "1.0\t11\tCeremony Content Volunteer",
    "0.0\t11\tVolunteer Manager",
    "1.0\t11\tBalloon Volunteer",
    "1.5\t11\tDeputy Hall Manager",
    "1.5\t11\tPress",
    "1.5\t11\tRegistration",
    "1.0\t11\tSpace Volunteer",
    "0.0\t11\tReserve",
    "0.0\t11\tNWRCC Participants",
    "0.0\t12\tPress Manager",
    "0.0\t12\tSystem Administrator",
    "0.0\t12\tExecutive Director, ICPC NERC Headquarters",
    "0.0\t12\tz_Cancelled",
    "0.0\t12\tVolunteer Manager",
    "1.5\t12\tDeputy Hall Manager",
    "1.0\t12\tHall Volunteer",
    "2.0\t12\tTechnical Specialist",
    "1.0\t12\tBalloon Volunteer",
    "0.0\t12\tTechnical Committee",
    "1.0\t12\tSpace Volunteer",
    "1.0\t12\tCeremony Content Volunteer",
    "0.0\t12\tContest Director",
    "1.5\t12\tLive Volunteer",
    "0.0\t12\tBalloon Manager",
    "2.0\t12\tDeputy Registration Manager",
    "1.0\t12\tProgrammer Volunteer",
    "1.5\t12\tRegistration",
    "0.0\t12\tRegistration Manager",
    "0.0\t12\tDirector of Operations",
    "1.5\t12\tPress",
    "2.0\t12\tHall Manager",
    "0.0\t12\tPCMS Manager",
    "0.0\t12\tNWRCC Participants",
    "0.0\t12\tEntertainment Manager",
    "2.0\t12\tTC Assistant",
    "0.0\t12\tReserve",
    "0.0\t13\tPress Manager",
    "0.0\t13\tSystem Administrator",
    "0.0\t13\tExecutive Director, ICPC NERC Headquarters",
    "0.0\t13\tz_Cancelled",
    "0.0\t13\tVolunteer Manager",
    "1.5\t13\tDeputy Hall Manager",
    "1.0\t13\tHall Volunteer",
    "2.0\t13\tTechnical Specialist",
    "1.0\t13\tBalloon Volunteer",
    "0.0\t13\tTechnical Committee",
    "1.0\t13\tSpace Volunteer",
    "1.0\t13\tCeremony Content Volunteer",
    "0.0\t13\tContest Director",
    "1.5\t13\tLive Volunteer",
    "0.0\t13\tBalloon Manager",
    "2.0\t13\tDeputy Registration Manager",
    "1.0\t13\tProgrammer Volunteer",
    "1.5\t13\tRegistration",
    "0.0\t13\tRegistration Manager",
    "0.0\t13\tDirector of Operations",
    "1.5\t13\tPress",
    "2.0\t13\tHall Manager",
    "0.0\t13\tPCMS Manager",
    "0.0\t13\tNWRCC Participants",
    "0.0\t13\tEntertainment Manager",
    "2.0\t13\tTC Assistant",
    "0.0\t13\tReserve",
]
old_year_mapping = {
    entry.split("\t")[0]: entry.split("\t")[1]
    for entry in [
        "3\t2017",
        "4\tHistory",
        "5\t2018",
        "6\t2019",
        "7\t2019 Qualification",
        "8\t2020",
        "9\t2021",
        "11\t2022",
        "12\t2023",
        "13\t2024",
    ]
}

HISTORICAL_MAPPING = {
    "exp-0.5": 7.0,
    "exp-0.8": 11.2,
    "exp-1": 14.0,
    "exp-1.5": 21.0,
    "exp-2": 28.0,
}


def upgrade() -> None:
    """Update position scores based on name patterns."""
    # Position score mappings: pattern -> score
    # Order matters: more specific patterns first to avoid overwriting

    for row in old_data:
        score, year_id, name = row.split("\t")
        year_name = old_year_mapping[year_id]
        name = f"{name} ({year_name})"
        op.execute(
            f"""
            UPDATE positions
            SET score = {score}
            WHERE name = '{name}'
            """  # noqa: S608
        )

    for name, score_val in HISTORICAL_MAPPING.items():
        op.execute(
            f"""
            UPDATE positions
            SET score = {score_val}
            WHERE name = '{name}'
            """  # noqa: S608
        )


def downgrade() -> None:
    """Revert position scores to default value."""
    op.execute(
        """
        UPDATE positions
        SET score = 1.0
        """
    )
