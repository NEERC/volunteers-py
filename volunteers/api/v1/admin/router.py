from fastapi import APIRouter, Depends

from volunteers.auth.deps import with_admin

from .assessment import router as assessment_router
from .day import router as day_router
from .hall import router as hall_router
from .position import router as position_router
from .user import router as user_router
from .user_day import router as user_day_router
from .year import router as year_router

router = APIRouter(tags=["admin"], dependencies=[Depends(with_admin)])
router.include_router(assessment_router.router, prefix="/assessment")
router.include_router(day_router.router, prefix="/day")
router.include_router(hall_router.router, prefix="/hall")
router.include_router(position_router.router, prefix="/position")
router.include_router(user_router.router, prefix="/user")
router.include_router(user_day_router.router, prefix="/user-day")
router.include_router(year_router.router, prefix="/year")
