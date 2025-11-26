from fastapi import APIRouter

from .v1.admin import router as admin_router
from .v1.attendance import router as attendance_router
from .v1.auth import router as auth_router
from .v1.year import router as year_router

router = APIRouter(prefix="/api/v1")

router.include_router(admin_router.router, prefix="/admin")
router.include_router(attendance_router.router, prefix="/attendance")
router.include_router(auth_router.router, prefix="/auth")
router.include_router(year_router.router, prefix="/year")
