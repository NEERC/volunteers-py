from fastapi import APIRouter

from .year import router as year_router

router = APIRouter(tags=["admin"])

router.include_router(year_router.router, prefix="/year")
