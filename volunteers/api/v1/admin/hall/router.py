from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.hall import HallEditIn, HallIn, HallOut
from volunteers.services.year import YearService

from .schemas import AddHallRequest, AddHallResponse, EditHallRequest

router = APIRouter(tags=["hall"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when hall successfully added",
            "model": AddHallResponse,
        },
    },
    description="Add new hall",
)
@inject
async def add_hall(
    request: AddHallRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddHallResponse:
    hall_in = HallIn(
        year_id=request.year_id,
        name=request.name,
        description=request.description,
    )
    hall = await year_service.add_hall(hall_in=hall_in)
    logger.info(f"Added hall {request.name}")

    response.status_code = status.HTTP_201_CREATED
    return AddHallResponse(hall_id=hall.id)


@router.post("/{hall_id}/edit")
@inject
async def edit_hall(
    hall_id: Annotated[int, Path(title="The ID of the hall")],
    request: EditHallRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    hall_edit_in = HallEditIn(
        name=request.name,
        description=request.description,
    )
    await year_service.edit_hall_by_hall_id(hall_id=hall_id, hall_edit_in=hall_edit_in)
    logger.info("Hall has been edited")


@router.get(
    "/year/{year_id}",
    response_model=list[HallOut],
    description="Get all halls for a year (admin only)",
)
@inject
async def get_year_halls(
    year_id: Annotated[int, Path(title="The ID of the year")],
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> list[HallOut]:
    halls = await year_service.get_halls_by_year_id(year_id=year_id)

    return [
        HallOut(
            hall_id=hall.id,
            year_id=hall.year_id,
            name=hall.name,
            description=hall.description,
        )
        for hall in halls
    ]
