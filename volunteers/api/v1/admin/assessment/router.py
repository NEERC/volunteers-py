from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.services.year import YearService

from .schemas import AddAssessmentRequest, AddAssessmentResponse, EditAssessmentRequest

router = APIRouter(tags=["assessment"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when assessment successfully added",
            "model": AddAssessmentResponse,
        },
    },
    description="Add new assessment",
)
@inject
async def add_assessment(
    request: AddAssessmentRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddAssessmentResponse:
    assessment_in = AssessmentIn(
        user_day_id=request.user_day_id, comment=request.comment, value=request.value
    )
    assessment = await year_service.add_assessment(assessment_in=assessment_in)
    logger.info("Added assessment")

    response.status_code = status.HTTP_201_CREATED
    return AddAssessmentResponse(assessment_id=assessment.id)


@router.post("/{assessment_id}/edit")
@inject
async def edit_assessment(
    assessment_id: Annotated[int, Path(title="The ID of the assessment")],
    request: EditAssessmentRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    assessment_edit_in = AssessmentEditIn(comment=request.comment, value=request.value)
    await year_service.edit_assessment_by_assessment_id(
        assessment_id=assessment_id, assessment_edit_in=assessment_edit_in
    )
    logger.info("Assessment has been edited")
