from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin

# Import the global container from di module instead of app
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.services.assessment import AssessmentService
from volunteers.services.year import YearService

from .schemas import (
    AddAssessmentRequest,
    AddAssessmentResponse,
    AssessmentItem,
    AssessmentsResponse,
    EditAssessmentRequest,
)

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
        user_day_id=request.user_day_id,
        comment=request.comment,
        value=request.value,
    )
    assessment = await year_service.add_assessment(assessment_in)
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
    assessment_edit_in = AssessmentEditIn(
        comment=request.comment,
        value=request.value,
    )
    await year_service.edit_assessment_by_assessment_id(
        assessment_id=assessment_id, assessment_edit_in=assessment_edit_in
    )
    logger.info("Assessment has been edited")


@router.delete(
    "/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Delete an assessment",
)
@inject
async def delete_assessment(
    assessment_id: Annotated[int, Path(title="The ID of the assessment")],
    _: Annotated[User, Depends(with_admin)],
    assessment_service: Annotated[
        AssessmentService,
        Depends(Provide[Container.assessment_service]),
    ],
) -> None:
    if not await assessment_service.delete_assessment(assessment_id):
        raise HTTPException(status_code=404, detail="Assessment not found")
    logger.info("Assessment has been deleted")


@router.get(
    "/user-day/{user_day_id}",
    response_model=AssessmentsResponse,
    description="Get all assessments for a user day",
)
@inject
async def get_user_day_assessments(
    user_day_id: Annotated[int, Path(title="The ID of the user day")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AssessmentsResponse:
    user_day = await year_service.get_user_day_by_id(user_day_id)
    if not user_day:
        raise HTTPException(status_code=404, detail="User day not found")

    assessment_items = [
        AssessmentItem(
            assessment_id=assessment.id,
            user_day_id=assessment.user_day_id,
            comment=assessment.comment,
            value=assessment.value,
        )
        for assessment in user_day.assessments
    ]

    return AssessmentsResponse(assessments=assessment_items)
