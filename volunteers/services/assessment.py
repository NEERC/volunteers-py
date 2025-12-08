from sqlalchemy import select

from volunteers.models import Assessment
from volunteers.schemas.assessment import AssessmentEditIn, AssessmentIn
from volunteers.services.base import BaseService


class AssessmentService(BaseService):
    async def add_assessment(self, assessment_in: AssessmentIn) -> Assessment:
        async with self.session_scope() as session:
            assessment = Assessment(**assessment_in.model_dump())
            session.add(assessment)
            await session.commit()
            await session.refresh(assessment)
            return assessment

    async def edit_assessment_by_assessment_id(
        self,
        assessment_id: int,
        assessment_edit_in: AssessmentEditIn,
    ) -> Assessment | None:
        async with self.session_scope() as session:
            assessment = await session.get(Assessment, assessment_id)
            if not assessment:
                return None
            for key, value in assessment_edit_in.model_dump(
                exclude_unset=True,
            ).items():
                setattr(assessment, key, value)
            await session.commit()
            await session.refresh(assessment)
            return assessment

    async def delete_assessment(self, assessment_id: int) -> bool:
        async with self.session_scope() as session:
            assessment = await session.get(Assessment, assessment_id)
            if not assessment:
                return False
            await session.delete(assessment)
            await session.commit()
            return True

    async def get_assessments_by_user_day_id(
        self,
        user_day_id: int,
    ) -> list[Assessment]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(Assessment).where(Assessment.user_day_id == user_day_id),
            )
            return list(result.scalars().all())
