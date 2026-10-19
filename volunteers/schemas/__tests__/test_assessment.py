from volunteers.models import User
from volunteers.schemas.assessment import AssessmentAuthorOut


def test_assessment_author_out_from_user() -> None:
    user = User(
        id=7,
        first_name_en="Ivan",
        last_name_en="Petrov",
        telegram_username="ipetrov",
    )

    author = AssessmentAuthorOut.model_validate(user)

    assert author == AssessmentAuthorOut(
        id=7,
        first_name_en="Ivan",
        last_name_en="Petrov",
        telegram_username="ipetrov",
    )
