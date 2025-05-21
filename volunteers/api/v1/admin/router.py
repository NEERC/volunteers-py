from fastapi import APIRouter

from .day import router as day_router
from .position import router as position_router
from .year import router as year_router

router = APIRouter(tags=["admin"])

router.include_router(day_router.router, prefix="/day")
router.include_router(position_router.router, prefix="/position")
router.include_router(year_router.router, prefix="/year")
