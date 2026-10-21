from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin

if TYPE_CHECKING:
    from .models import User


class MailingStatus(str, enum.Enum):
    DRAFT = "draft"
    QUEUED = "queued"
    SENDING = "sending"
    DONE = "done"
    CANCELLED = "cancelled"


class MailingMessageStatus(str, enum.Enum):
    PENDING = "pending"
    # Handed to Telegram, the result is not recorded yet. Becomes `unknown` if the sender dies
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    # Delivery is uncertain (network error, crash during the request), never resent automatically
    UNKNOWN = "unknown"
    # The recipient has no Telegram account
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class AssignmentMode(str, enum.Enum):
    """Messages for an application form with several matching assignments."""

    FIRST = "first"  # one message, for the assignment of the earliest day
    ALL = "all"  # a message per assignment


class Mailing(Base, TimestampMixin):
    """Telegram mailing to application forms of a year."""

    __tablename__ = "mailings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    year_id: Mapped[int] = mapped_column(ForeignKey("years.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String, default="")
    status: Mapped[MailingStatus] = mapped_column(
        Enum(
            MailingStatus,
            name="mailing_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MailingStatus.DRAFT,
    )

    # Jinja2 templates of the message (Telegram HTML) and of the link buttons: [{text, url}]
    template: Mapped[str] = mapped_column(String, default="")
    buttons: Mapped[list[dict[str, str]]] = mapped_column(JSONB, default=list)
    # Assignment filter, see `MailingFilter`
    filter: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    excluded_form_ids: Mapped[list[int]] = mapped_column(JSONB, default=list)
    assignment_mode: Mapped[AssignmentMode] = mapped_column(
        Enum(
            AssignmentMode,
            name="mailing_assignment_mode_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AssignmentMode.FIRST,
    )

    created_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    started_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    started_by: Mapped[User | None] = relationship(foreign_keys=[started_by_id])
    # Order of the sending queue, set on start and on resend
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MailingMessage(Base, TimestampMixin):
    """A message of a started mailing: rendered on start and never changed afterwards."""

    __tablename__ = "mailing_messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    mailing_id: Mapped[int] = mapped_column(ForeignKey("mailings.id", ondelete="CASCADE"))
    application_form_id: Mapped[int | None] = mapped_column(
        ForeignKey("application_forms.id", ondelete="SET NULL"), nullable=True
    )
    user_day_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_days.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Snapshot of the recipient for the history, the linked entities may change or disappear
    recipient_name: Mapped[str] = mapped_column(String)
    telegram_username: Mapped[str | None] = mapped_column(String, nullable=True)
    assignment_label: Mapped[str | None] = mapped_column(String, nullable=True)

    chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    text: Mapped[str] = mapped_column(String)
    buttons: Mapped[list[dict[str, str]]] = mapped_column(JSONB, default=list)

    status: Mapped[MailingMessageStatus] = mapped_column(
        Enum(
            MailingMessageStatus,
            name="mailing_message_status_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=MailingMessageStatus.PENDING,
    )
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_mailing_messages_mailing_id_status", "mailing_id", "status"),
        Index("ix_mailing_messages_mailing_id_updated_at", "mailing_id", "updated_at"),
    )
