"""Background sending of mailings.

A message is sent at most once. A single sender holds a session-level advisory lock, so the lock
is released as soon as its process or connection dies. Every message is marked `sending` in its
own transaction before the request to Telegram and gets the result in another one after it.
Messages still `sending` when the lock is taken were interrupted by a dead sender: they may or may
not have been delivered, so they become `unknown` and are resent only by an admin.
"""

import asyncio
import contextlib
from datetime import UTC, datetime
from typing import Protocol

import aiogram
from aiogram.exceptions import (
    TelegramAPIError,
    TelegramNetworkError,
    TelegramRetryAfter,
    TelegramServerError,
)
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncConnection

from volunteers.bot.notify import Notifier
from volunteers.models import (
    Mailing,
    MailingMessage,
    MailingMessageStatus,
    MailingStatus,
    User,
)

from .base import BaseService

# Key of the advisory lock of the sender
SENDER_LOCK_KEY = 0x6D61696C696E67


class MessageSender(Protocol):
    async def send(self, chat_id: int, text: str, buttons: list[dict[str, str]]) -> int:
        """Send a Telegram HTML message with link buttons, returns the id of the message."""
        ...


class TelegramSender:
    def __init__(self, bot: aiogram.Bot) -> None:
        self.bot = bot

    async def send(self, chat_id: int, text: str, buttons: list[dict[str, str]]) -> int:
        markup = (
            InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text=button["text"], url=button["url"])]
                    for button in buttons
                ]
            )
            if buttons
            else None
        )
        message = await self.bot.send_message(
            chat_id=chat_id, text=text, parse_mode="HTML", reply_markup=markup
        )
        return message.message_id


def mailing_url(public_url: str | None, mailing: Mailing) -> str | None:
    if not public_url:
        return None
    return f"{public_url.rstrip('/')}/{mailing.year_id}/mailings/{mailing.id}"


class MailingWorker(BaseService):
    def __init__(
        self,
        sender: MessageSender,
        notifier: Notifier,
        public_url: str | None = None,
        messages_per_second: float = 20,
        poll_interval: float = 2,
    ) -> None:
        super().__init__()
        self.sender = sender
        self.notifier = notifier
        self.public_url = public_url
        self.send_interval = 1 / messages_per_second
        self.poll_interval = poll_interval
        self._wake = asyncio.Event()

    def wake(self) -> None:
        """Look at the queue right away, e.g. after a mailing is started."""
        self._wake.set()

    async def run(self) -> None:
        self.logger.info("Mailing worker started")
        while True:
            self._wake.clear()
            try:
                await self.run_once()
            except Exception:
                self.logger.exception("Mailing worker failed, retrying")
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake.wait(), self.poll_interval)

    async def run_once(self) -> bool:
        """Send all queued mailings if no other sender is running. Returns whether it was."""
        async with self.db.connect() as connection:
            lock = await connection.execution_options(isolation_level="AUTOCOMMIT")
            try:
                locked = await lock.scalar(select(func.pg_try_advisory_lock(SENDER_LOCK_KEY)))
                if not locked:
                    return False
                await self._recover_interrupted()
                while (mailing_id := await self._next_mailing()) is not None:
                    await self._send_mailing(mailing_id, lock)
                return True
            finally:
                # Closing the connection releases the lock, also when it's broken
                await connection.invalidate()

    async def _recover_interrupted(self) -> None:
        async with self.session_scope() as session:
            result = await session.execute(
                update(MailingMessage)
                .where(MailingMessage.status == MailingMessageStatus.SENDING)
                .values(
                    status=MailingMessageStatus.UNKNOWN,
                    error="Sending was interrupted, the message may or may not have been delivered",
                    updated_at=func.clock_timestamp(),
                )
                .returning(MailingMessage.id)
            )
            interrupted = result.scalars().all()
            await session.commit()
        if interrupted:
            self.logger.warning(f"Messages {list(interrupted)} were interrupted, marked unknown")

    async def _next_mailing(self) -> int | None:
        async with self.session_scope() as session:
            mailing_id: int | None = await session.scalar(
                select(Mailing.id)
                .where(Mailing.status.in_([MailingStatus.QUEUED, MailingStatus.SENDING]))
                .order_by(Mailing.queued_at, Mailing.id)
                .limit(1)
            )
            return mailing_id

    async def _send_mailing(self, mailing_id: int, lock: AsyncConnection) -> None:
        async with self.session_scope() as session:
            await session.execute(
                update(Mailing)
                .where(Mailing.id == mailing_id)
                .values(
                    status=MailingStatus.SENDING,
                    started_at=func.coalesce(Mailing.started_at, func.now()),
                )
            )
            await session.commit()
        self.logger.info(f"Sending mailing {mailing_id}")

        while True:
            # Fails when the connection holding the lock is lost: another sender may take over
            await lock.execute(select(1))

            async with self.session_scope() as session:
                status = await session.scalar(
                    select(Mailing.status).where(Mailing.id == mailing_id)
                )
                if status != MailingStatus.SENDING:
                    break
                message = await session.scalar(
                    select(MailingMessage)
                    .where(
                        MailingMessage.mailing_id == mailing_id,
                        MailingMessage.status == MailingMessageStatus.PENDING,
                    )
                    .order_by(MailingMessage.id)
                    .limit(1)
                )
                if message is None:
                    await session.execute(
                        update(Mailing)
                        .where(Mailing.id == mailing_id, Mailing.status == MailingStatus.SENDING)
                        .values(status=MailingStatus.DONE, finished_at=func.now())
                    )
                    await session.commit()
                    break
                claimed = await session.scalar(
                    update(MailingMessage)
                    .where(
                        MailingMessage.id == message.id,
                        MailingMessage.status == MailingMessageStatus.PENDING,
                    )
                    .values(status=MailingMessageStatus.SENDING, updated_at=func.clock_timestamp())
                    .returning(MailingMessage.id)
                )
                await session.commit()
            if claimed is None:  # cancelled meanwhile
                continue

            await self._deliver(message)
            await asyncio.sleep(self.send_interval)

        await self._notify_finished(mailing_id)

    async def _send(
        self, chat_id: int, text: str, buttons: list[dict[str, str]]
    ) -> tuple[MailingMessageStatus, str | None, int | None]:
        """Send the message, returns its status, the error and the Telegram message id."""
        while True:
            try:
                return (
                    MailingMessageStatus.SENT,
                    None,
                    await self.sender.send(chat_id, text, buttons),
                )
            except TelegramRetryAfter as e:
                # Not delivered for sure, safe to repeat
                self.logger.warning(f"Rate limited, waiting {e.retry_after}s")
                await asyncio.sleep(e.retry_after)
            except (TelegramNetworkError, TelegramServerError) as e:
                # The request may have reached Telegram
                return MailingMessageStatus.UNKNOWN, str(e), None
            except TelegramAPIError as e:
                return MailingMessageStatus.FAILED, str(e), None
            except Exception as e:
                return MailingMessageStatus.UNKNOWN, str(e) or e.__class__.__name__, None

    async def _deliver(self, message: MailingMessage) -> None:
        result: tuple[MailingMessageStatus, str | None, int | None]
        if message.chat_id is None:  # never pending: skipped on start
            result = MailingMessageStatus.FAILED, "The recipient has no Telegram account", None
        else:
            result = await self._send(message.chat_id, message.text, message.buttons)
        status, error, telegram_message_id = result

        async with self.session_scope() as session:
            await session.execute(
                update(MailingMessage)
                .where(MailingMessage.id == message.id)
                .values(
                    status=status,
                    error=error,
                    telegram_message_id=telegram_message_id,
                    sent_at=datetime.now(tz=UTC) if status == MailingMessageStatus.SENT else None,
                    updated_at=func.clock_timestamp(),
                )
            )
            await session.commit()

    async def _notify_finished(self, mailing_id: int) -> None:
        async with self.session_scope() as session:
            mailing = await session.get(Mailing, mailing_id)
            if mailing is None:
                return
            result = await session.execute(
                select(MailingMessage.status, func.count())
                .where(MailingMessage.mailing_id == mailing_id)
                .group_by(MailingMessage.status)
            )
            counts = dict(result.tuples().all())
            starter = (
                await session.get(User, mailing.started_by_id) if mailing.started_by_id else None
            )

        outcome = "cancelled" if mailing.status == MailingStatus.CANCELLED else "finished"
        summary = ", ".join(
            f"{label} {counts.get(status, 0)}"
            for label, status in (
                ("sent", MailingMessageStatus.SENT),
                ("failed", MailingMessageStatus.FAILED),
                ("unknown", MailingMessageStatus.UNKNOWN),
                ("skipped", MailingMessageStatus.SKIPPED),
                ("cancelled", MailingMessageStatus.CANCELLED),
            )
            if counts.get(status) or status == MailingMessageStatus.SENT
        )
        lines = [f"Mailing «{mailing.title}» {outcome}: {summary}"]
        if starter is not None:
            lines.append(f"(by {starter.first_name_ru} {starter.last_name_ru})")
        url = mailing_url(self.public_url, mailing)
        if url:
            lines.append(url)
        self.logger.info(lines[0])
        await self.notifier.notify("\n".join(lines))
