from fastapi import APIRouter

from volunteers.api.v1.auth import router as auth_router
from volunteers.api.v1.year import router as year_router

router = APIRouter(prefix="/api/v1")

router.include_router(auth_router.router, prefix="/auth")
router.include_router(year_router.router, prefix="/year")
