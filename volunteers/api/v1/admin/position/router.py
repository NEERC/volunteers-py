from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.position import PositionEditIn, PositionIn
from volunteers.services.year import YearService

from .schemas import AddPositionRequest, AddPositionResponse, EditPositionRequest

router = APIRouter(tags=["position"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {"description": "Returned when position successfully added"},
    },
    description="Add new position",
)
@inject
async def add_position(
    request: AddPositionRequest,
    response: Response,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> AddPositionResponse:
    position_in = PositionIn(year_id=request.year_id, name=request.name)
    position = await year_service.add_position(position_in=position_in)
    logger.info(f"Added position {request.name}")

    response.status_code = status.HTTP_201_CREATED
    return AddPositionResponse(position_id=position.id)


@router.post("/{position_id}/edit")
@inject
async def edit_position(
    position_id: Annotated[int, Path(title="The ID of the position")],
    request: EditPositionRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    position_edit_in = PositionEditIn(name=request.name)
    await year_service.edit_position_by_position_id(
        position_id=position_id, position_edit_in=position_edit_in
    )
    logger.info("Position has been edited")
