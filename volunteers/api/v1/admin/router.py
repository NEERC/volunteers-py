from fastapi import APIRouter

from .position import router as position_router
from .year import router as year_router

router = APIRouter(tags=["admin"])

router.include_router(position_router.router, prefix="/position")
router.include_router(year_router.router, prefix="/year")
