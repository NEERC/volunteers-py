from pydantic import BaseModel

from volunteers.schemas.base import BaseSuccessResponse


class AddAssessmentRequest(BaseModel):
    user_day_id: int
    comment: str
    value: float


class AddAssessmentResponse(BaseSuccessResponse):
    assessment_id: int


class EditAssessmentRequest(BaseModel):
    comment: str | None = None
    value: float | None = None


class AssessmentItem(BaseModel):
    assessment_id: int
    user_day_id: int
    comment: str
    value: float


class AssessmentsResponse(BaseModel):
    assessments: list[AssessmentItem]
