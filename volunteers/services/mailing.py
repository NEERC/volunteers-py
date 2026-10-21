from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from volunteers.models import (
    ApplicationForm,
    IdentityProvider,
    Mailing,
    MailingMessage,
    MailingMessageStatus,
    MailingStatus,
    User,
    UserDay,
    Year,
)
from volunteers.models.mailing import AssignmentMode
from volunteers.schemas.mailing import MailingDraft

from .base import BaseService
from .errors import DomainError
from .mailing_sender import MailingWorker, MessageSender
from .mailing_template import (
    AssignmentContext,
    DayContext,
    FormContext,
    HallContext,
    PositionContext,
    RenderedMessage,
    RenderError,
    TemplateContext,
    UserContext,
    YearContext,
    render_message,
    uses_assignment,
)


class MailingError(DomainError):
    pass


class MailingNotFound(MailingError):
    def __init__(self) -> None:
        super().__init__("Mailing not found")


class MailingYearNotFound(MailingError):
    def __init__(self) -> None:
        super().__init__("Year not found")


class MailingNotDraft(MailingError):
    def __init__(self) -> None:
        super().__init__("The mailing is already started")


class MailingNotCancellable(MailingError):
    def __init__(self) -> None:
        super().__init__("Only a queued or sending mailing can be cancelled")


class MailingNotResendable(MailingError):
    def __init__(self) -> None:
        super().__init__("Messages can be resent only in a sending or finished mailing")


class MailingRecipientNotFound(MailingError):
    def __init__(self) -> None:
        super().__init__("The recipient is not in the mailing")


class MailingNoRecipients(MailingError):
    def __init__(self) -> None:
        super().__init__("The mailing has no recipients with Telegram")


class MailingTestSendFailed(MailingError):
    pass


class MailingAdminWithoutTelegram(MailingTestSendFailed):
    def __init__(self) -> None:
        super().__init__("Link your Telegram account to receive test messages")


@dataclass
class RecipientRenderError:
    form_id: int
    user_day_id: int | None
    recipient_name: str
    error: RenderError


class MailingInvalid(MailingError):
    """Some messages can't be rendered or would be rejected by Telegram."""

    def __init__(self, errors: list[RecipientRenderError]) -> None:
        super().__init__(f"{len(errors)} messages have errors")
        self.errors = errors


@dataclass
class Recipient:
    form: ApplicationForm
    chat_id: int | None
    excluded: bool
    # Assignments matching the filter, by day
    assignments: list[UserDay]
    # Assignment of each message to send, `None` for a message without an assignment
    message_assignments: list[UserDay | None]

    @property
    def name(self) -> str:
        user = self.form.user
        parts = [user.last_name_ru, user.first_name_ru, user.patronymic_ru]
        return " ".join(part for part in parts if part)


@dataclass
class RecipientsPlan:
    year: Year
    recipients: list[Recipient]
    uses_assignment: bool
    # Some assignments to send are on days with unpublished assignments
    has_unpublished_days: bool
    messages: int = field(init=False)
    skipped_messages: int = field(init=False)

    def __post_init__(self) -> None:
        included = [r for r in self.recipients if not r.excluded]
        self.messages = sum(len(r.message_assignments) for r in included if r.chat_id is not None)
        self.skipped_messages = sum(
            len(r.message_assignments) for r in included if r.chat_id is None
        )


def assignment_label(user_day: UserDay) -> str:
    parts = [user_day.day.name, user_day.position.name]
    if user_day.hall is not None:
        parts.append(user_day.hall.name)
    return " · ".join(parts)


def template_context(
    year: Year, form: ApplicationForm, user_day: UserDay | None
) -> TemplateContext:
    user = form.user
    assignment = None
    if user_day is not None:
        hall = user_day.hall
        assignment = AssignmentContext(
            day=DayContext(
                id=user_day.day.id, name=user_day.day.name, information=user_day.day.information
            ),
            position=PositionContext(
                id=user_day.position.id,
                name=user_day.position.name,
                description=user_day.position.description,
            ),
            hall=HallContext(id=hall.id, name=hall.name, description=hall.description)
            if hall is not None
            else None,
            attendance=user_day.attendance.value,
            information=user_day.information,
        )
    return TemplateContext(
        user=UserContext(
            first_name_ru=user.first_name_ru,
            last_name_ru=user.last_name_ru,
            patronymic_ru=user.patronymic_ru,
            first_name_en=user.first_name_en,
            last_name_en=user.last_name_en,
            telegram_username=user.telegram_username,
            phone=user.phone,
            email=user.email,
        ),
        form=FormContext(itmo_group=form.itmo_group, needs_invitation=form.needs_invitation),
        year=YearContext(year_name=year.year_name),
        assignment=assignment,
        day=assignment.day if assignment else None,
        position=assignment.position if assignment else None,
        hall=assignment.hall if assignment else None,
    )


def _chat_id(user: User) -> int | None:
    subject = user.identity_subject(IdentityProvider.TELEGRAM)
    return int(subject) if subject is not None else None


def _apply_draft(mailing: Mailing, draft: MailingDraft) -> None:
    mailing.title = draft.title
    mailing.template = draft.template
    mailing.buttons = [button.model_dump() for button in draft.buttons]
    mailing.filter = draft.filter.model_dump(mode="json")
    mailing.excluded_form_ids = draft.excluded_form_ids
    mailing.assignment_mode = draft.assignment_mode


def mailing_draft(mailing: Mailing) -> MailingDraft:
    return MailingDraft.model_validate(
        {
            "title": mailing.title,
            "template": mailing.template,
            "buttons": mailing.buttons,
            "filter": mailing.filter,
            "excluded_form_ids": mailing.excluded_form_ids,
            "assignment_mode": mailing.assignment_mode,
        }
    )


class MailingService(BaseService):
    def __init__(self, sender: MessageSender, worker: MailingWorker) -> None:
        super().__init__()
        self.sender = sender
        self.worker = worker

    async def get_mailings(self, year_id: int) -> list[Mailing]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(Mailing)
                .where(Mailing.year_id == year_id)
                .options(selectinload(Mailing.created_by), selectinload(Mailing.started_by))
                .order_by(Mailing.id.desc())
            )
            return list(result.scalars().all())

    async def get_mailing(self, mailing_id: int) -> Mailing:
        async with self.session_scope() as session:
            mailing = await session.get(
                Mailing,
                mailing_id,
                options=[selectinload(Mailing.created_by), selectinload(Mailing.started_by)],
            )
            if mailing is None:
                raise MailingNotFound
            return mailing

    async def get_message_counts(
        self, mailing_ids: list[int]
    ) -> dict[int, dict[MailingMessageStatus, int]]:
        async with self.session_scope() as session:
            result = await session.execute(
                select(MailingMessage.mailing_id, MailingMessage.status, func.count())
                .where(MailingMessage.mailing_id.in_(mailing_ids))
                .group_by(MailingMessage.mailing_id, MailingMessage.status)
            )
            counts: dict[int, dict[MailingMessageStatus, int]] = {i: {} for i in mailing_ids}
            for mailing_id, status, count in result.tuples():
                counts[mailing_id][status] = count
            return counts

    async def get_messages(
        self,
        mailing_id: int,
        status: MailingMessageStatus | None = None,
        updated_after: datetime | None = None,
    ) -> list[MailingMessage]:
        async with self.session_scope() as session:
            query = select(MailingMessage).where(MailingMessage.mailing_id == mailing_id)
            if status is not None:
                query = query.where(MailingMessage.status == status)
            if updated_after is not None:
                query = query.where(MailingMessage.updated_at > updated_after)
            result = await session.execute(query.order_by(MailingMessage.id))
            return list(result.scalars().all())

    async def create_draft(
        self, year_id: int, author_id: int, source_mailing_id: int | None = None
    ) -> Mailing:
        """Create an empty draft, or a copy of another mailing."""
        async with self.session_scope() as session:
            if await session.get(Year, year_id) is None:
                raise MailingYearNotFound
            mailing = Mailing(year_id=year_id, created_by_id=author_id)
            if source_mailing_id is not None:
                source = await session.get(Mailing, source_mailing_id)
                if source is None:
                    raise MailingNotFound
                _apply_draft(mailing, mailing_draft(source))
                # Forms of another year can't be excluded here
                if source.year_id != year_id:
                    mailing.excluded_form_ids = []
                    mailing.filter = {}
            else:
                _apply_draft(mailing, MailingDraft())
            session.add(mailing)
            await session.commit()
            return mailing

    async def update_draft(self, mailing_id: int, draft: MailingDraft) -> Mailing:
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id, with_for_update=True)
            if mailing is None:
                raise MailingNotFound
            if mailing.status != MailingStatus.DRAFT:
                raise MailingNotDraft
            _apply_draft(mailing, draft)
            await session.commit()
            return mailing

    async def delete_draft(self, mailing_id: int) -> None:
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id, with_for_update=True)
            if mailing is None:
                raise MailingNotFound
            if mailing.status != MailingStatus.DRAFT:
                raise MailingNotDraft
            await session.delete(mailing)
            await session.commit()

    async def _plan(
        self, session: AsyncSession, year_id: int, draft: MailingDraft
    ) -> RecipientsPlan:
        year = await session.get(Year, year_id)
        if year is None:
            raise MailingYearNotFound
        result = await session.execute(
            select(ApplicationForm)
            .where(ApplicationForm.year_id == year_id)
            .options(
                selectinload(ApplicationForm.user).selectinload(User.identities),
                selectinload(ApplicationForm.user_days).options(
                    selectinload(UserDay.day),
                    selectinload(UserDay.position),
                    selectinload(UserDay.hall),
                ),
            )
        )
        forms = sorted(
            result.scalars().all(),
            key=lambda f: (f.user.last_name_ru, f.user.first_name_ru, f.id),
        )

        with_assignment = uses_assignment(
            draft.template, [button.model_dump() for button in draft.buttons]
        )
        excluded = set(draft.excluded_form_ids)
        recipients = []
        for form in forms:
            assignments: list[UserDay] = []
            message_assignments: list[UserDay | None] = [None]
            if not draft.filter.is_empty():
                assignments = sorted(
                    (ud for ud in form.user_days if draft.filter.matches(ud)),
                    key=lambda ud: (ud.day_id, ud.id),
                )
                if not assignments:
                    continue
                if with_assignment:
                    message_assignments = list(
                        assignments[:1]
                        if draft.assignment_mode == AssignmentMode.FIRST
                        else assignments
                    )
            recipients.append(
                Recipient(
                    form=form,
                    chat_id=_chat_id(form.user),
                    excluded=form.id in excluded,
                    assignments=assignments,
                    message_assignments=message_assignments,
                )
            )

        has_unpublished_days = any(
            ud is not None and not ud.day.assignment_published
            for r in recipients
            if not r.excluded
            for ud in r.message_assignments
        )
        return RecipientsPlan(year, recipients, with_assignment, has_unpublished_days)

    async def get_recipients(self, year_id: int, draft: MailingDraft) -> RecipientsPlan:
        async with self.session_scope() as session:
            return await self._plan(session, year_id, draft)

    async def preview(
        self, year_id: int, draft: MailingDraft, form_id: int, user_day_id: int | None
    ) -> RenderedMessage:
        """Render the message for one of the recipients of the draft."""
        async with self.session_scope() as session:
            plan = await self._plan(session, year_id, draft)
        for recipient in plan.recipients:
            if recipient.form.id != form_id:
                continue
            for user_day in recipient.message_assignments:
                if (user_day.id if user_day else None) == user_day_id:
                    return render_message(
                        draft.template,
                        [button.model_dump() for button in draft.buttons],
                        template_context(plan.year, recipient.form, user_day),
                    )
        raise MailingRecipientNotFound

    async def test_send(
        self,
        year_id: int,
        draft: MailingDraft,
        form_id: int,
        user_day_id: int | None,
        admin_id: int,
    ) -> None:
        """Send the message rendered for a recipient to the admin, nothing is recorded."""
        message = await self.preview(year_id, draft, form_id, user_day_id)
        if message.errors:
            raise MailingTestSendFailed(message.errors[0].message)
        async with self.session_scope() as session:
            admin = await session.scalar(
                select(User).where(User.id == admin_id).options(selectinload(User.identities))
            )
        chat_id = _chat_id(admin) if admin else None
        if chat_id is None:
            raise MailingAdminWithoutTelegram
        try:
            await self.sender.send(
                chat_id,
                message.text,
                [{"text": b.text, "url": b.url} for b in message.buttons],
            )
        except Exception as e:
            raise MailingTestSendFailed(str(e)) from e

    async def start(self, mailing_id: int, user_id: int) -> Mailing:
        """Render and record all messages of the draft, and put it to the sending queue."""
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id, with_for_update=True)
            if mailing is None:
                raise MailingNotFound
            if mailing.status != MailingStatus.DRAFT:
                raise MailingNotDraft
            draft = mailing_draft(mailing)
            plan = await self._plan(session, mailing.year_id, draft)
            buttons = [button.model_dump() for button in draft.buttons]

            messages: list[MailingMessage] = []
            errors: list[RecipientRenderError] = []
            for recipient in plan.recipients:
                if recipient.excluded:
                    continue
                for user_day in recipient.message_assignments:
                    rendered = render_message(
                        draft.template,
                        buttons,
                        template_context(plan.year, recipient.form, user_day),
                    )
                    # Messages that won't be sent don't have to be valid
                    if recipient.chat_id is not None:
                        errors.extend(
                            RecipientRenderError(
                                recipient.form.id,
                                user_day.id if user_day else None,
                                recipient.name,
                                error,
                            )
                            for error in rendered.errors
                        )
                    messages.append(
                        MailingMessage(
                            mailing_id=mailing.id,
                            application_form_id=recipient.form.id,
                            user_day_id=user_day.id if user_day else None,
                            user_id=recipient.form.user_id,
                            recipient_name=recipient.name,
                            telegram_username=recipient.form.user.telegram_username,
                            assignment_label=assignment_label(user_day) if user_day else None,
                            chat_id=recipient.chat_id,
                            text=rendered.text,
                            buttons=[{"text": b.text, "url": b.url} for b in rendered.buttons],
                            status=MailingMessageStatus.PENDING
                            if recipient.chat_id is not None
                            else MailingMessageStatus.SKIPPED,
                        )
                    )
            if errors:
                raise MailingInvalid(errors)
            if plan.messages == 0:
                raise MailingNoRecipients

            session.add_all(messages)
            mailing.status = MailingStatus.QUEUED
            mailing.started_by_id = user_id
            mailing.queued_at = datetime.now(tz=UTC)
            await session.commit()
            await session.refresh(mailing)
        self.logger.info(f"Mailing {mailing_id} queued: {plan.messages} messages")
        self.worker.wake()
        return mailing

    async def cancel(self, mailing_id: int) -> Mailing:
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id, with_for_update=True)
            if mailing is None:
                raise MailingNotFound
            if mailing.status not in (MailingStatus.QUEUED, MailingStatus.SENDING):
                raise MailingNotCancellable
            mailing.status = MailingStatus.CANCELLED
            mailing.finished_at = datetime.now(tz=UTC)
            await session.execute(
                update(MailingMessage)
                .where(
                    MailingMessage.mailing_id == mailing_id,
                    MailingMessage.status == MailingMessageStatus.PENDING,
                )
                .values(status=MailingMessageStatus.CANCELLED, updated_at=func.clock_timestamp())
            )
            await session.commit()
            await session.refresh(mailing)
            return mailing

    async def resend(self, mailing_id: int, message_ids: list[int]) -> Mailing:
        """Send the failed or unknown messages again."""
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id, with_for_update=True)
            if mailing is None:
                raise MailingNotFound
            if mailing.status not in (MailingStatus.SENDING, MailingStatus.DONE):
                raise MailingNotResendable
            result = await session.execute(
                update(MailingMessage)
                .where(
                    MailingMessage.mailing_id == mailing_id,
                    MailingMessage.id.in_(message_ids),
                    MailingMessage.status.in_(
                        [MailingMessageStatus.FAILED, MailingMessageStatus.UNKNOWN]
                    ),
                )
                .values(
                    status=MailingMessageStatus.PENDING,
                    error=None,
                    updated_at=func.clock_timestamp(),
                )
                .returning(MailingMessage.id)
            )
            resent = result.scalars().all()
            if resent and mailing.status == MailingStatus.DONE:
                mailing.status = MailingStatus.QUEUED
                mailing.queued_at = datetime.now(tz=UTC)
                mailing.finished_at = None
            await session.commit()
            await session.refresh(mailing)
        if resent:
            self.logger.info(f"Mailing {mailing_id}: resending messages {list(resent)}")
            self.worker.wake()
        return mailing
