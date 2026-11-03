import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Annotated

from dependency_injector.wiring import Provide, inject
from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request
from fastapi.responses import StreamingResponse

from volunteers.auth.deps import with_admin
from volunteers.core.di import Container
from volunteers.models import Mailing, MailingMessage, MailingMessageStatus, MailingStatus, User
from volunteers.schemas.base import BaseSuccessResponse
from volunteers.schemas.mailing import MailingButton, MailingDraft
from volunteers.services.mailing import (
    MailingError,
    MailingInvalid,
    MailingNoRecipients,
    MailingNotCancellable,
    MailingNotDraft,
    MailingNotResendable,
    MailingService,
    MailingTestSendFailed,
    mailing_draft,
)
from volunteers.services.mailing_template import RenderError, template_variables

from .schemas import (
    CreateMailingRequest,
    MailingCounts,
    MailingEvent,
    MailingListResponse,
    MailingMessageResponse,
    MailingMessagesResponse,
    MailingPreviewRequest,
    MailingPreviewResponse,
    MailingRecipient,
    MailingRecipientError,
    MailingRecipientsResponse,
    MailingRenderError,
    MailingResponse,
    MailingUser,
    RecipientAssignment,
    ResendMessagesRequest,
    StartMailingResponse,
    TemplateVariablesResponse,
)

router = APIRouter(tags=["mailing"])

# How often the event stream looks at the database
EVENTS_POLL_INTERVAL = 1.0
# Messages updated this long before the last seen update are looked at again: a transaction
# that started earlier may commit later
EVENTS_OVERLAP = timedelta(seconds=10)
EVENTS_KEEPALIVE = timedelta(seconds=15)
FINISHED_STATUSES = (MailingStatus.DRAFT, MailingStatus.DONE, MailingStatus.CANCELLED)

MailingServiceDep = Annotated[MailingService, Depends(Provide[Container.mailing_service])]


def _http_error(error: MailingError) -> HTTPException:
    if isinstance(error, MailingNotDraft | MailingNotCancellable | MailingNotResendable):
        status_code = 409
    elif isinstance(error, MailingNoRecipients | MailingTestSendFailed):
        status_code = 400
    else:
        status_code = 404
    return HTTPException(status_code=status_code, detail=str(error))


def _mailing_user(user: User | None) -> MailingUser | None:
    if user is None:
        return None
    return MailingUser(user_id=user.id, name=f"{user.first_name_ru} {user.last_name_ru}")


def _mailing_response(mailing: Mailing, counts: dict[MailingMessageStatus, int]) -> MailingResponse:
    draft = mailing_draft(mailing)
    return MailingResponse(
        mailing_id=mailing.id,
        year_id=mailing.year_id,
        title=draft.title,
        status=mailing.status,
        template=draft.template,
        buttons=draft.buttons,
        filter=draft.filter,
        excluded_form_ids=draft.excluded_form_ids,
        assignment_mode=draft.assignment_mode,
        created_by=_mailing_user(mailing.created_by),
        started_by=_mailing_user(mailing.started_by),
        created_at=mailing.created_at,
        queued_at=mailing.queued_at,
        started_at=mailing.started_at,
        finished_at=mailing.finished_at,
        counts=MailingCounts(**{status.value: count for status, count in counts.items()}),
    )


async def _get_mailing_response(service: MailingService, mailing_id: int) -> MailingResponse:
    try:
        mailing = await service.get_mailing(mailing_id)
    except MailingError as e:
        raise _http_error(e) from e
    counts = await service.get_message_counts([mailing_id])
    return _mailing_response(mailing, counts[mailing_id])


def _message_response(message: MailingMessage) -> MailingMessageResponse:
    return MailingMessageResponse(
        message_id=message.id,
        form_id=message.application_form_id,
        user_day_id=message.user_day_id,
        user_id=message.user_id,
        recipient_name=message.recipient_name,
        telegram_username=message.telegram_username,
        assignment_label=message.assignment_label,
        text=message.text,
        buttons=[MailingButton.model_validate(button) for button in message.buttons],
        status=message.status,
        error=message.error,
        sent_at=message.sent_at,
        updated_at=message.updated_at,
    )


def _render_error(error: RenderError) -> MailingRenderError:
    return MailingRenderError(
        field=error.field, message=error.message, button=error.button, line=error.line
    )


@router.get("/template-variables", description="Variables available in mailing templates")
async def get_template_variables() -> TemplateVariablesResponse:
    return TemplateVariablesResponse(variables=template_variables())


@router.get("/year/{year_id}", description="Mailings of the year, newest first")
@inject
async def get_mailings(
    year_id: Annotated[int, Path(title="The ID of the year")],
    mailing_service: MailingServiceDep,
) -> MailingListResponse:
    mailings = await mailing_service.get_mailings(year_id)
    counts = await mailing_service.get_message_counts([m.id for m in mailings])
    return MailingListResponse(mailings=[_mailing_response(m, counts[m.id]) for m in mailings])


@router.post("/year/{year_id}", description="Create a draft mailing, empty or a copy of another")
@inject
async def create_mailing(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: CreateMailingRequest,
    user: Annotated[User, Depends(with_admin)],
    mailing_service: MailingServiceDep,
) -> MailingResponse:
    try:
        mailing = await mailing_service.create_draft(year_id, user.id, request.source_mailing_id)
    except MailingError as e:
        raise _http_error(e) from e
    return await _get_mailing_response(mailing_service, mailing.id)


@router.post("/year/{year_id}/recipients", description="Recipients of a draft mailing")
@inject
async def get_recipients(
    year_id: Annotated[int, Path(title="The ID of the year")],
    draft: MailingDraft,
    mailing_service: MailingServiceDep,
) -> MailingRecipientsResponse:
    try:
        plan = await mailing_service.get_recipients(year_id, draft)
    except MailingError as e:
        raise _http_error(e) from e
    return MailingRecipientsResponse(
        recipients=[
            MailingRecipient(
                form_id=r.form.id,
                user_id=r.form.user_id,
                name=r.name,
                telegram_username=r.form.user.telegram_username,
                has_telegram=r.chat_id is not None,
                excluded=r.excluded,
                assignments=[
                    RecipientAssignment(
                        user_day_id=ud.id,
                        day_id=ud.day_id,
                        day_name=ud.day.name,
                        day_published=ud.day.assignment_published,
                        position_id=ud.position_id,
                        position_name=ud.position.name,
                        hall_id=ud.hall_id,
                        hall_name=ud.hall.name if ud.hall else None,
                        attendance=ud.attendance,
                    )
                    for ud in r.assignments
                ],
                message_user_day_ids=[ud.id if ud else None for ud in r.message_assignments],
            )
            for r in plan.recipients
        ],
        uses_assignment=plan.uses_assignment,
        has_unpublished_days=plan.has_unpublished_days,
        messages=plan.messages,
        skipped_messages=plan.skipped_messages,
    )


@router.post("/year/{year_id}/preview", description="Render a draft mailing for a recipient")
@inject
async def preview_message(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: MailingPreviewRequest,
    mailing_service: MailingServiceDep,
) -> MailingPreviewResponse:
    try:
        message = await mailing_service.preview(
            year_id, request.draft, request.form_id, request.user_day_id
        )
    except MailingError as e:
        raise _http_error(e) from e
    return MailingPreviewResponse(
        text=message.text,
        buttons=[MailingButton(text=b.text, url=b.url) for b in message.buttons],
        errors=[_render_error(error) for error in message.errors],
    )


@router.post(
    "/year/{year_id}/test-send",
    description="Send the message rendered for a recipient to the Telegram of the admin",
)
@inject
async def test_send_message(
    year_id: Annotated[int, Path(title="The ID of the year")],
    request: MailingPreviewRequest,
    user: Annotated[User, Depends(with_admin)],
    mailing_service: MailingServiceDep,
) -> BaseSuccessResponse:
    try:
        await mailing_service.test_send(
            year_id, request.draft, request.form_id, request.user_day_id, user.id
        )
    except MailingError as e:
        raise _http_error(e) from e
    return BaseSuccessResponse()


@router.get("/{mailing_id}", description="Get a mailing")
@inject
async def get_mailing(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    mailing_service: MailingServiceDep,
) -> MailingResponse:
    return await _get_mailing_response(mailing_service, mailing_id)


@router.post("/{mailing_id}/edit", description="Save a draft mailing")
@inject
async def edit_mailing(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    draft: MailingDraft,
    mailing_service: MailingServiceDep,
) -> MailingResponse:
    try:
        await mailing_service.update_draft(mailing_id, draft)
    except MailingError as e:
        raise _http_error(e) from e
    return await _get_mailing_response(mailing_service, mailing_id)


@router.delete("/{mailing_id}", description="Delete a draft mailing")
@inject
async def delete_mailing(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    mailing_service: MailingServiceDep,
) -> BaseSuccessResponse:
    try:
        await mailing_service.delete_draft(mailing_id)
    except MailingError as e:
        raise _http_error(e) from e
    return BaseSuccessResponse()


@router.post(
    "/{mailing_id}/start",
    description="Save the draft and start the mailing: render, validate and queue all messages",
)
@inject
async def start_mailing(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    draft: MailingDraft,
    user: Annotated[User, Depends(with_admin)],
    mailing_service: MailingServiceDep,
) -> StartMailingResponse:
    try:
        await mailing_service.update_draft(mailing_id, draft)
        await mailing_service.start(mailing_id, user.id)
    except MailingInvalid as e:
        return StartMailingResponse(
            started=False,
            mailing=await _get_mailing_response(mailing_service, mailing_id),
            description=str(e),
            errors=[
                MailingRecipientError(
                    **_render_error(error.error).model_dump(),
                    form_id=error.form_id,
                    user_day_id=error.user_day_id,
                    recipient_name=error.recipient_name,
                )
                for error in e.errors
            ],
        )
    except MailingNoRecipients as e:
        return StartMailingResponse(
            started=False,
            mailing=await _get_mailing_response(mailing_service, mailing_id),
            description=str(e),
        )
    except MailingError as e:
        raise _http_error(e) from e
    return StartMailingResponse(
        started=True, mailing=await _get_mailing_response(mailing_service, mailing_id)
    )


@router.post(
    "/{mailing_id}/cancel", description="Cancel a mailing: messages not sent yet are not sent"
)
@inject
async def cancel_mailing(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    mailing_service: MailingServiceDep,
) -> MailingResponse:
    try:
        await mailing_service.cancel(mailing_id)
    except MailingError as e:
        raise _http_error(e) from e
    return await _get_mailing_response(mailing_service, mailing_id)


@router.post("/{mailing_id}/resend", description="Send failed or unknown messages again")
@inject
async def resend_messages(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    request: ResendMessagesRequest,
    mailing_service: MailingServiceDep,
) -> MailingResponse:
    try:
        await mailing_service.resend(mailing_id, request.message_ids)
    except MailingError as e:
        raise _http_error(e) from e
    return await _get_mailing_response(mailing_service, mailing_id)


@router.get("/{mailing_id}/messages", description="Messages of a started mailing")
@inject
async def get_messages(
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    mailing_service: MailingServiceDep,
    status: Annotated[MailingMessageStatus | None, Query()] = None,
) -> MailingMessagesResponse:
    messages = await mailing_service.get_messages(mailing_id, status=status)
    return MailingMessagesResponse(messages=[_message_response(m) for m in messages])


@router.get(
    "/{mailing_id}/events",
    description=(
        "Server-sent events of the mailing: `update` events with the mailing and the messages "
        "changed since the previous event (all messages in the first one), and an `end` event "
        "once the mailing is finished. The id of an event is passed in Last-Event-ID on "
        "reconnection to get only the later changes."
    ),
    response_class=StreamingResponse,
)
@inject
async def mailing_events(
    request: Request,
    mailing_id: Annotated[int, Path(title="The ID of the mailing")],
    mailing_service: MailingServiceDep,
    last_event_id: Annotated[str | None, Header()] = None,
) -> StreamingResponse:
    await _get_mailing_response(mailing_service, mailing_id)  # 404 before the stream starts
    cursor: datetime | None = None
    if last_event_id:
        try:
            cursor = datetime.fromisoformat(last_event_id)
        except ValueError:
            cursor = None

    async def stream() -> AsyncGenerator[str]:
        nonlocal cursor
        # Update time of the messages already sent, to skip them in the overlap
        sent: dict[int, datetime] = {}
        last_mailing: MailingResponse | None = None
        last_event = datetime.now(tz=UTC)
        while not await request.is_disconnected():
            # The mailing first: once it's finished, all message updates are committed
            mailing = await _get_mailing_response(mailing_service, mailing_id)
            since = cursor - EVENTS_OVERLAP if cursor else None
            messages = [
                m
                for m in await mailing_service.get_messages(mailing_id, updated_after=since)
                if sent.get(m.id) != m.updated_at
            ]
            for m in messages:
                sent[m.id] = m.updated_at
                cursor = max(cursor, m.updated_at) if cursor else m.updated_at

            now = datetime.now(tz=UTC)
            if messages or mailing != last_mailing:
                event = MailingEvent(
                    mailing=mailing, messages=[_message_response(m) for m in messages]
                )
                event_id = cursor.isoformat() if cursor else ""
                yield f"id: {event_id}\nevent: update\ndata: {event.model_dump_json()}\n\n"
                last_mailing, last_event = mailing, now
            elif now - last_event > EVENTS_KEEPALIVE:
                yield ": keepalive\n\n"
                last_event = now

            if mailing.status in FINISHED_STATUSES:
                yield "event: end\ndata: {}\n\n"
                return
            await asyncio.sleep(EVENTS_POLL_INTERVAL)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
