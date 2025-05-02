from typing import Annotated

from fastapi import APIRouter, Depends, Path, status

from volunteers.api.v1.year.schemas import (
    # ApplicationFormYearSavedResponse,
    ApplicationFormYearSaveRequest,
)
from volunteers.auth.deps import with_user
from volunteers.models.user import User

router = APIRouter(prefix="/year", tags=["year"])


# @router.get("/{year_id}", description="Return year positions and saved user form data")
# async def get_form_year(
#     year_id: Annotated[int, Path(title="The ID of the year")],
#     user: Annotated[User, Depends(with_user)],
# ) -> ApplicationFormYearSavedResponse:
#     pass


@router.post(
    "/{year_id}",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when user signed up form for the first time"
        },
        status.HTTP_204_NO_CONTENT: {"description": "Returned when user updated form"},
    },
    description="Save user year form data",
)
async def save_form_year(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: ApplicationFormYearSaveRequest,
    user: Annotated[User, Depends(with_user)],
) -> None:
    pass
