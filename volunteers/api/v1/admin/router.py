from fastapi import APIRouter, Depends

from volunteers.auth.deps import with_admin

from .assessment.router import router as assessment_router
from .day.router import router as day_router
from .hall.router import router as hall_router
from .position.router import router as position_router
from .user.router import router as user_router
from .user_day.router import router as user_day_router
from .year.router import router as year_router

router = APIRouter(tags=["admin"], dependencies=[Depends(with_admin)])
router.include_router(assessment_router, prefix="/assessment")
router.include_router(day_router, prefix="/day")
router.include_router(hall_router, prefix="/hall")
router.include_router(position_router, prefix="/position")
router.include_router(user_router, prefix="/user")
router.include_router(user_day_router, prefix="/user-day")
router.include_router(year_router, prefix="/year")
