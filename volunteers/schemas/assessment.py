from pydantic import BaseModel, Field, field_validator


class CommentRequired(ValueError):
    def __init__(self) -> None:
        super().__init__("Comment must not be empty")


class AssessmentIn(BaseModel):
    user_day_id: int
    comment: str
    value: float = Field(description="Assessment value (any real number)")

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise CommentRequired()
        return trimmed


class AssessmentEditIn(BaseModel):
    comment: str | None
    value: float | None = Field(
        None,
        description="Assessment value (any real number)",
    )

    @field_validator("comment")
    @classmethod
    def validate_optional_comment(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            raise CommentRequired()
        return trimmed


class AssessmentOut(AssessmentIn):
    assessment_id: int
