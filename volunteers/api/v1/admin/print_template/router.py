from collections.abc import AsyncGenerator
from pathlib import PurePosixPath
from typing import Annotated, Any

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.orm import undefer

from volunteers.core.di import Container
from volunteers.models import Day, PrintTemplate, PrintTemplateAsset, Year
from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.mailing import MailingDraft
from volunteers.services.errors import DomainError
from volunteers.services.mailing import MailingService, RecipientsPlan, template_context
from volunteers.services.mailing_template import TemplateContext
from volunteers.services.print_pdf import (
    PrintCompilationError,
    compile_pdf,
    default_assets,
    starter_source,
)

from .schemas import (
    CreatePrintTemplate,
    EditPrintTemplate,
    PrintAsset,
    PrintContext,
    PrintPreviewRequest,
    PrintRecipient,
    PrintRecipients,
    PrintRenderRequest,
    PrintTemplateDetail,
    PrintTemplateList,
    PrintTemplateSummary,
)

router = APIRouter(prefix="/year/{year_id}", tags=["print-template"])


@inject
async def print_session(
    db: Annotated[AsyncEngine, Depends(Provide[Container.db])],
) -> AsyncGenerator[AsyncSession]:
    async with AsyncSession(db, expire_on_commit=False) as session:
        yield session


PrintSession = Annotated[AsyncSession, Depends(print_session)]


async def _template(
    session: AsyncSession, year_id: int, template_id: int, *, lock: bool = False
) -> PrintTemplate:
    query = select(PrintTemplate).where(
        PrintTemplate.id == template_id, PrintTemplate.year_id == year_id
    )
    result = await session.scalar(query.with_for_update() if lock else query)
    if result is None:
        raise HTTPException(status_code=404, detail="Print template not found")
    return result


async def _detail(session: AsyncSession, template: PrintTemplate) -> PrintTemplateDetail:
    assets = await session.scalars(
        select(PrintTemplateAsset)
        .where(PrintTemplateAsset.template_id == template.id)
        .order_by(PrintTemplateAsset.id)
    )
    return PrintTemplateDetail(
        id=template.id,
        year_id=template.year_id,
        title=template.title,
        source=template.source,
        assets=[PrintAsset.model_validate(asset) for asset in assets],
    )


@router.get("")
async def list_print_templates(year_id: int, session: PrintSession) -> PrintTemplateList:
    templates = await session.scalars(
        select(PrintTemplate)
        .where(PrintTemplate.year_id == year_id)
        .order_by(PrintTemplate.id.desc())
    )
    return PrintTemplateList(
        templates=[PrintTemplateSummary.model_validate(template) for template in templates]
    )


@router.post("")
async def create_print_template(
    year_id: int, request: CreatePrintTemplate, session: PrintSession
) -> PrintTemplateDetail:
    if await session.get(Year, year_id) is None:
        raise HTTPException(status_code=404, detail="Year not found")
    template = PrintTemplate(year_id=year_id, title=request.title, source=starter_source())
    session.add(template)
    await session.flush()
    for name, content_type, data in default_assets():
        session.add(
            PrintTemplateAsset(
                template_id=template.id,
                file_name=name,
                content_type=content_type,
                size=len(data),
                data=data,
            )
        )
    await session.commit()
    return await _detail(session, template)


@router.get("/{template_id}")
async def get_print_template(
    year_id: int, template_id: int, session: PrintSession
) -> PrintTemplateDetail:
    return await _detail(session, await _template(session, year_id, template_id))


@router.patch("/{template_id}")
async def edit_print_template(
    year_id: int, template_id: int, request: EditPrintTemplate, session: PrintSession
) -> PrintTemplateDetail:
    template = await _template(session, year_id, template_id, lock=True)
    template.title = request.title
    template.source = request.source
    await session.commit()
    return await _detail(session, template)


@router.delete("/{template_id}")
async def delete_print_template(
    year_id: int, template_id: int, session: PrintSession
) -> BaseSuccessResponse:
    await session.delete(await _template(session, year_id, template_id, lock=True))
    await session.commit()
    return BaseSuccessResponse()


MAX_ASSET_SIZE = 5 * 1024**2
ASSET_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff2": "font/woff2",
}


@router.post("/{template_id}/assets")
async def upload_print_asset(
    year_id: int,
    template_id: int,
    session: PrintSession,
    file: Annotated[UploadFile, File()],
) -> PrintAsset:
    name = file.filename or ""
    content_type = (
        "text/plain" if name == "std.typ" else ASSET_TYPES.get(PurePosixPath(name).suffix.lower())
    )
    if (
        content_type is None
        or len(name.encode()) > 240
        or name.startswith(".")
        or any(c in name for c in "/\\:")
        or not name.isprintable()
    ):
        raise HTTPException(status_code=422, detail="Unsupported print asset name or file type")
    data = await file.read(MAX_ASSET_SIZE + 1)
    if len(data) > MAX_ASSET_SIZE:
        raise HTTPException(status_code=413, detail="Print assets must be at most 5 MB")
    if not data:
        raise HTTPException(status_code=422, detail="Print asset is empty")
    if name == "std.typ":
        try:
            data.decode()
        except UnicodeDecodeError as e:
            raise HTTPException(status_code=422, detail="std.typ must be UTF-8") from e

    await _template(session, year_id, template_id, lock=True)
    asset = await session.scalar(
        select(PrintTemplateAsset).where(
            PrintTemplateAsset.template_id == template_id,
            PrintTemplateAsset.file_name == name,
        )
    )
    if asset is None:
        asset = PrintTemplateAsset(template_id=template_id, file_name=name)
        session.add(asset)
    asset.content_type = content_type
    asset.size = len(data)
    asset.data = data
    await session.commit()
    return PrintAsset.model_validate(asset)


async def _asset(
    session: AsyncSession,
    template_id: int,
    asset_id: int,
    *,
    include_data: bool = False,
) -> PrintTemplateAsset:
    query = select(PrintTemplateAsset).where(
        PrintTemplateAsset.template_id == template_id, PrintTemplateAsset.id == asset_id
    )
    asset = await session.scalar(
        query.options(undefer(PrintTemplateAsset.data)) if include_data else query
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="Print asset not found")
    return asset


@router.get("/{template_id}/assets/{asset_id}", response_class=Response)
async def get_print_asset(
    year_id: int,
    template_id: int,
    asset_id: int,
    session: PrintSession,
) -> Response:
    await _template(session, year_id, template_id)
    asset = await _asset(session, template_id, asset_id, include_data=True)
    return Response(
        asset.data,
        media_type=asset.content_type,
        headers={"Content-Disposition": "attachment", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/{template_id}/assets/{asset_id}")
async def delete_print_asset(
    year_id: int,
    template_id: int,
    asset_id: int,
    session: PrintSession,
) -> BaseSuccessResponse:
    await _template(session, year_id, template_id, lock=True)
    asset = await _asset(session, template_id, asset_id)
    if asset.file_name == "std.typ":
        raise HTTPException(status_code=409, detail="std.typ can be edited")
    await session.delete(asset)
    await session.commit()
    return BaseSuccessResponse()


MailingServiceDep = Annotated[MailingService, Depends(Provide[Container.mailing_service])]
PDF_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {"content": {"application/pdf": {"schema": {"type": "string", "format": "binary"}}}},
    204: {"description": "No matching recipients"},
}


async def _recipient_plan(
    session: AsyncSession,
    year_id: int,
    settings: PrintContext,
    mailing: MailingService,
) -> RecipientsPlan:
    day = await session.get(Day, settings.day_id)
    if day is None or day.year_id != year_id:
        raise HTTPException(status_code=404, detail="Day not found")
    await session.commit()  # Release the read transaction before the mailing planner opens its own.
    draft = MailingDraft(
        filter=settings.filter.model_copy(update={"day_ids": [settings.day_id]}),
        assignment_mode=settings.assignment_mode,
        excluded_form_ids=settings.excluded_form_ids,
    )
    try:
        return await mailing.get_recipients(year_id, draft, force_assignment=True)
    except DomainError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


def _recipient_data(plan: RecipientsPlan) -> list[tuple[PrintRecipient, TemplateContext]]:
    return [
        (
            PrintRecipient(
                form_id=recipient.form.id, user_day_id=assignment.id, name=recipient.name
            ),
            template_context(plan.year, recipient.form, assignment),
        )
        for recipient in plan.recipients
        if not recipient.excluded
        for assignment in recipient.message_assignments
        if assignment is not None
    ]


@router.post("/{template_id}/recipients")
@inject
async def list_print_recipients(
    year_id: int,
    template_id: int,
    request: PrintContext,
    session: PrintSession,
    mailing: MailingServiceDep,
) -> PrintRecipients:
    await _template(session, year_id, template_id)
    plan = await _recipient_plan(session, year_id, request, mailing)
    return PrintRecipients(recipients=[recipient for recipient, _ in _recipient_data(plan)])


async def _pdf(
    session: AsyncSession,
    template: PrintTemplate,
    source: str,
    contexts: list[TemplateContext],
) -> bytes:
    assets = await session.scalars(
        select(PrintTemplateAsset)
        .where(PrintTemplateAsset.template_id == template.id)
        .options(undefer(PrintTemplateAsset.data))
    )
    files = {asset.file_name: asset.data for asset in assets}
    await session.rollback()
    try:
        return await compile_pdf(source, contexts, files)
    except PrintCompilationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/{template_id}/preview", response_class=Response, responses=PDF_RESPONSES)
@inject
async def preview_print_template(
    year_id: int,
    template_id: int,
    request: PrintPreviewRequest,
    session: PrintSession,
    mailing: MailingServiceDep,
) -> Response:
    template = await _template(session, year_id, template_id)
    plan = await _recipient_plan(session, year_id, request, mailing)
    matches = [
        context
        for recipient, context in _recipient_data(plan)
        if (request.form_id is None or recipient.form_id == request.form_id)
        and (request.user_day_id is None or recipient.user_day_id == request.user_day_id)
    ]
    if not matches:
        return Response(status_code=204)
    source = request.source if request.source is not None else template.source
    return Response(
        await _pdf(session, template, source, matches[:1]),
        media_type="application/pdf",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/{template_id}/generate", response_class=Response, responses=PDF_RESPONSES)
@inject
async def generate_print_template(
    year_id: int,
    template_id: int,
    request: PrintRenderRequest,
    session: PrintSession,
    mailing: MailingServiceDep,
) -> Response:
    template = await _template(session, year_id, template_id)
    plan = await _recipient_plan(session, year_id, request, mailing)
    contexts = [context for _, context in _recipient_data(plan)]
    if not contexts:
        return Response(status_code=204)
    source = request.source if request.source is not None else template.source
    pdf = await _pdf(session, template, source, contexts)
    return StreamingResponse(
        iter((pdf,)),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="badges-{request.day_id}.pdf"',
            "Cache-Control": "no-store",
        },
    )
