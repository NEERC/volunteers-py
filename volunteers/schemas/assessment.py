from pydantic import BaseModel


class AssessmentIn(BaseModel):
    user_day_id: int
    comment: str
    value: float


class AssessmentEditIn(BaseModel):
    comment: str | None
    value: float | None


class AssessmentOut(AssessmentIn):
    assessment_id: int
