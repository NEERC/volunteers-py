from datetime import UTC, datetime
from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import StreamingResponse
from loguru import logger

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import ApplicationForm, User, UserIdentity
from volunteers.schemas.user import UserUpdate
from volunteers.services.export import ExportService
from volunteers.services.identity import IdentityService
from volunteers.services.user import UserService
from volunteers.services.user_merge import UserMergeError, UserMergeService

from .schemas import (
    AllUsersResponse,
    EditUserRequest,
    MergeFormConflict,
    MergeFormDay,
    MergeFormSummary,
    MergeIdentityConflict,
    MergePreviewResponse,
    MergeUsersRequest,
    UserIdentityResponse,
    UserResponse,
)

router = APIRouter(tags=["user"])


def _user_response(
    user: User, identities: list[UserIdentityResponse] | None = None
) -> UserResponse:
    return UserResponse(
        user_id=user.id,
        first_name_ru=user.first_name_ru,
        last_name_ru=user.last_name_ru,
        patronymic_ru=user.patronymic_ru,
        first_name_en=user.first_name_en,
        last_name_en=user.last_name_en,
        isu_id=user.isu_id,
        phone=user.phone,
        email=user.email,
        telegram_username=user.telegram_username,
        is_admin=user.is_admin,
        gender=user.gender,
        identities=identities,
    )


def _identity_response(identity: UserIdentity) -> UserIdentityResponse:
    return UserIdentityResponse(
        id=identity.id,
        provider=identity.provider,
        subject=identity.subject,
        display_name=identity.display_name,
        created_at=identity.created_at,
    )


async def _user_identities(
    user_id: int, identity_service: IdentityService
) -> list[UserIdentityResponse]:
    return [_identity_response(i) for i in await identity_service.get_user_identities(user_id)]


@router.get(
    "/export-csv",
    description="Export all users to CSV format",
)
@inject
async def export_users_csv(
    _: Annotated[User, Depends(with_admin)],
    export_service: Annotated[ExportService, Depends(Provide[Container.export_service])],
) -> StreamingResponse:
    """Export all users data to CSV format including participation in years."""
    csv_content = await export_service.export_all_users()

    # Create filename with timestamp
    timestamp = datetime.now(tz=UTC).strftime("%Y%m%d_%H%M%S")
    filename = f"all_users_{timestamp}.csv"

    logger.info("Exporting all users data to CSV")

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "",
    response_model=AllUsersResponse,
    description="Get list of all users",
)
@inject
async def get_all_users(
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
) -> AllUsersResponse:
    users = await user_service.get_all_users()
    user_list = [_user_response(user) for user in users]
    return AllUsersResponse(users=user_list)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    description="Get user by ID",
)
@inject
async def get_user_by_id(
    user_id: Annotated[int, Path(title="The ID of the user")],
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> UserResponse:
    user = await user_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return _user_response(user, await _user_identities(user.id, identity_service))


@router.post("/{user_id}/edit")
@inject
async def edit_user(
    user_id: Annotated[int, Path(title="The ID of the user")],
    request: EditUserRequest,
    _: Annotated[User, Depends(with_admin)],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> UserResponse:
    user_update = UserUpdate(**request.model_dump())
    updated_user = await user_service.update_user(user_id=user_id, user_update=user_update)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"User {user_id} has been edited")
    return _user_response(updated_user, await _user_identities(updated_user.id, identity_service))


@router.delete("/{user_id}/identities/{identity_id}")
@inject
async def delete_user_identity(
    user_id: Annotated[int, Path(title="The ID of the user")],
    identity_id: Annotated[int, Path(title="The ID of the identity")],
    _: Annotated[User, Depends(with_admin)],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> list[UserIdentityResponse]:
    identity = await identity_service.get_identity_by_id(identity_id)
    if identity is None or identity.user_id != user_id:
        raise HTTPException(status_code=404, detail="Identity not found")
    await identity_service.delete_identity(identity_id)
    logger.info(f"Identity {identity_id} ({identity.provider.value}) of user {user_id} deleted")
    return await _user_identities(user_id, identity_service)


def _form_summary(form: ApplicationForm) -> MergeFormSummary:
    return MergeFormSummary(
        form_id=form.id,
        user_id=form.user_id,
        itmo_group=form.itmo_group,
        comments=form.comments,
        created_at=form.created_at,
        desired_positions=sorted(position.name for position in form.desired_positions),
        days=[
            MergeFormDay(
                day_name=user_day.day.name,
                position_name=user_day.position.name,
                assessments_count=len(user_day.assessments),
            )
            for user_day in sorted(form.user_days, key=lambda d: d.day_id)
        ],
    )


@router.get(
    "/{user_id}/merge/{other_user_id}",
    description="Preview of merging two users: the result and the conflicts to resolve",
)
@inject
async def get_merge_preview(
    user_id: Annotated[int, Path(title="The ID of the user")],
    other_user_id: Annotated[int, Path(title="The ID of the user to merge with")],
    _: Annotated[User, Depends(with_admin)],
    user_merge_service: Annotated[UserMergeService, Depends(Provide[Container.user_merge_service])],
) -> MergePreviewResponse:
    try:
        plan = await user_merge_service.plan_merge(user_id, other_user_id)
    except UserMergeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    target = _user_response(plan.target, [_identity_response(i) for i in plan.target.identities])
    source = _user_response(plan.source, [_identity_response(i) for i in plan.source.identities])
    return MergePreviewResponse(
        target=target,
        source=source,
        merged=target.model_copy(update=plan.merged_fields),
        form_conflicts=[
            MergeFormConflict(
                year_id=conflict.year_id,
                year_name=conflict.year_name,
                forms=[_form_summary(form) for form in conflict.forms],
            )
            for conflict in plan.form_conflicts
        ],
        identity_conflicts=[
            MergeIdentityConflict(
                provider=conflict.provider,
                identities=[_identity_response(i) for i in conflict.identities],
            )
            for conflict in plan.identity_conflicts
        ],
    )


@router.post(
    "/{user_id}/merge/{other_user_id}",
    description="Merge two users into the older one (smaller id), deleting the newer one",
)
@inject
async def merge_users(
    user_id: Annotated[int, Path(title="The ID of the user")],
    other_user_id: Annotated[int, Path(title="The ID of the user to merge with")],
    request: MergeUsersRequest,
    _: Annotated[User, Depends(with_admin)],
    user_merge_service: Annotated[UserMergeService, Depends(Provide[Container.user_merge_service])],
    user_service: Annotated[UserService, Depends(Provide[Container.user_service])],
    identity_service: Annotated[IdentityService, Depends(Provide[Container.identity_service])],
) -> UserResponse:
    try:
        target_id = await user_merge_service.merge(
            user_id,
            other_user_id,
            kept_form_ids=request.kept_form_ids,
            kept_identity_ids=request.kept_identity_ids,
        )
    except UserMergeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    user = await user_service.get_user_by_id(target_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_response(user, await _user_identities(user.id, identity_service))
