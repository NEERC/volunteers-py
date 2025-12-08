from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import User
from volunteers.schemas.position import PositionEditIn, PositionIn
from volunteers.services.errors import DomainError  # ← обязательно импортируем
from volunteers.services.year import YearService

from .schemas import AddPositionRequest, AddPositionResponse, EditPositionRequest

router = APIRouter(tags=["position"])


@router.post(
    "/add",
    responses={
        status.HTTP_201_CREATED: {
            "description": "Returned when position successfully added",
            "model": AddPositionResponse,
        },
        status.HTTP_400_BAD_REQUEST: {
            "description": "Position with this name already exists or other validation error",
        },
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
    try:
        position_in = PositionIn(
            year_id=request.year_id,
            name=request.name,
            can_desire=request.can_desire,
            has_halls=request.has_halls,
            is_manager=request.is_manager,
            save_for_next_year=request.save_for_next_year,
            score=request.score,
            description=request.description,
        )
        position = await year_service.add_position(position_in=position_in)
        logger.info(f"Added position {request.name}")

        response.status_code = status.HTTP_201_CREATED
        return AddPositionResponse(position_id=position.id)

    except DomainError as exc:
        # Expected business error -> return 400 with a clear message
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/{position_id}/edit",
    responses={
        status.HTTP_200_OK: {"description": "Position successfully updated"},
        status.HTTP_400_BAD_REQUEST: {
            "description": "Position with this name already exists or other validation error"
        },
    },
)
@inject
async def edit_position(
    position_id: Annotated[int, Path(title="The ID of the position")],
    request: EditPositionRequest,
    _: Annotated[User, Depends(with_admin)],
    year_service: Annotated[YearService, Depends(Provide[Container.year_service])],
) -> None:
    try:
        position_edit_in = PositionEditIn(
            name=request.name,
            can_desire=request.can_desire,
            has_halls=request.has_halls,
            is_manager=request.is_manager,
            save_for_next_year=request.save_for_next_year,
            score=request.score,
            description=request.description,
        )
        await year_service.edit_position_by_position_id(
            position_id=position_id,
            position_edit_in=position_edit_in,
        )
        logger.info(f"Position {position_id} has been edited")

    except DomainError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
