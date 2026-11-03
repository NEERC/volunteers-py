import os
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass

import pytest
from aiogram.exceptions import (
    TelegramForbiddenError,
    TelegramNetworkError,
    TelegramRetryAfter,
    TelegramServerError,
)
from aiogram.methods import SendMessage
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    async_sessionmaker,
    create_async_engine,
)

from volunteers.models import (
    ApplicationForm,
    Attendance,
    Day,
    Hall,
    IdentityProvider,
    Mailing,
    MailingMessage,
    MailingMessageStatus,
    MailingStatus,
    Position,
    User,
    UserDay,
    UserIdentity,
    Year,
)
from volunteers.models.base import metadata
from volunteers.models.mailing import AssignmentMode
from volunteers.schemas.mailing import MailingButton, MailingDraft, MailingFilter
from volunteers.services.mailing import (
    MailingAdminWithoutTelegram,
    MailingInvalid,
    MailingNoRecipients,
    MailingNotCancellable,
    MailingNotDraft,
    MailingService,
)
from volunteers.services.mailing_sender import SENDER_LOCK_KEY, MailingWorker

# Admin URL of a Postgres server, e.g. postgresql+asyncpg://postgres:postgres@localhost:5432/postgres.
# A temporary database is created on it for every test.
TEST_DATABASE_URL = os.environ.get("VOLUNTEERS_TEST_DATABASE_URL")

METHOD = SendMessage(chat_id=0, text="")


class FakeSender:
    """Records sent messages, raises the errors queued for a chat instead of sending."""

    def __init__(self) -> None:
        self.sent: list[tuple[int, str, list[dict[str, str]]]] = []
        self.errors: dict[int, list[Exception]] = {}

    async def send(self, chat_id: int, text: str, buttons: list[dict[str, str]]) -> int:
        if self.errors.get(chat_id):
            raise self.errors[chat_id].pop(0)
        self.sent.append((chat_id, text, buttons))
        return len(self.sent)

    def chats(self) -> list[int]:
        return [chat_id for chat_id, _, _ in self.sent]


class FakeNotifier:
    def __init__(self) -> None:
        self.messages: list[str] = []

    async def notify(self, message: str) -> None:
        self.messages.append(message)


@pytest.fixture
async def engine() -> AsyncGenerator[AsyncEngine]:
    if not TEST_DATABASE_URL:
        pytest.skip("VOLUNTEERS_TEST_DATABASE_URL is not set")
    db_name = f"volunteers_test_{uuid.uuid4().hex[:12]}"
    admin = create_async_engine(TEST_DATABASE_URL, isolation_level="AUTOCOMMIT")
    async with admin.connect() as conn:
        await conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    engine = create_async_engine(TEST_DATABASE_URL.rsplit("/", 1)[0] + f"/{db_name}")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
        yield engine
    finally:
        await engine.dispose()
        async with admin.connect() as conn:
            await conn.execute(text(f'DROP DATABASE "{db_name}" WITH (FORCE)'))
        await admin.dispose()


@pytest.fixture
def sender() -> FakeSender:
    return FakeSender()


@pytest.fixture
def notifier() -> FakeNotifier:
    return FakeNotifier()


@pytest.fixture
def worker(engine: AsyncEngine, sender: FakeSender, notifier: FakeNotifier) -> MailingWorker:
    worker = MailingWorker(
        sender,
        notifier,  # type: ignore[arg-type]
        public_url="https://volunteers.example/",
        messages_per_second=1000,
    )
    worker.db = engine
    return worker


@pytest.fixture
def service(engine: AsyncEngine, sender: FakeSender, worker: MailingWorker) -> MailingService:
    service = MailingService(sender, worker)
    service.db = engine
    return service


@dataclass
class Seed:
    year_id: int
    admin_id: int
    day1_id: int
    day2_id: int
    registration_id: int
    hall_position_id: int
    hall_id: int
    # Forms: alice (day 1 registration in the hall, day 2 registration without a hall),
    # bob (day 1 hall position in the hall), carol (no Telegram, day 2 registration),
    # dave (no assignments)
    alice_form_id: int
    bob_form_id: int
    carol_form_id: int
    dave_form_id: int
    alice_day1_id: int
    alice_day2_id: int


ALICE, BOB, DAVE, ADMIN = 101, 102, 104, 900


def make_user(first_name: str, last_name: str, **kwargs: object) -> User:
    return User(
        first_name_ru=first_name,
        last_name_ru=last_name,
        first_name_en=first_name,
        last_name_en=last_name,
        is_admin=False,
        **kwargs,
    )


@pytest.fixture
async def seed(engine: AsyncEngine) -> Seed:
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        year = Year(year_name="2026", open_for_registration=True)
        other_year = Year(year_name="2025", open_for_registration=False)
        session.add_all([year, other_year])
        await session.flush()
        day1 = Day(year_id=year.id, name="Day 1", information="", assignment_published=True)
        day2 = Day(year_id=year.id, name="Day 2", information="", assignment_published=False)
        registration = Position(year_id=year.id, name="Registration")
        hall_position = Position(year_id=year.id, name="Hall", has_halls=True)
        hall = Hall(year_id=year.id, name="Main hall")
        session.add_all([day1, day2, registration, hall_position, hall])

        alice = make_user("Alice", "Anderson", telegram_username="alice")
        bob = make_user("Bob", "Brown", telegram_username="bob")
        carol = make_user("Carol", "Clark")
        dave = make_user("Dave <3", "Davis", telegram_username="dave")
        eve = make_user("Eve", "Evans", telegram_username="eve")
        admin = make_user("Admin", "Adams", telegram_username="admin")
        admin.is_admin = True
        session.add_all([alice, bob, carol, dave, eve, admin])
        await session.flush()
        session.add_all(
            [
                UserIdentity(user_id=user.id, provider=IdentityProvider.TELEGRAM, subject=str(tg))
                for user, tg in (
                    (alice, ALICE),
                    (bob, BOB),
                    (dave, DAVE),
                    (eve, 105),
                    (admin, ADMIN),
                )
            ]
        )

        forms = {
            name: ApplicationForm(year_id=year.id, user_id=user.id, itmo_group="M3100")
            for name, user in (("alice", alice), ("bob", bob), ("carol", carol), ("dave", dave))
        }
        session.add_all([*forms.values(), ApplicationForm(year_id=other_year.id, user_id=eve.id)])
        await session.flush()

        def assign(
            form: str, day: Day, position: Position, hall: Hall | None, attendance: Attendance
        ) -> UserDay:
            return UserDay(
                application_form_id=forms[form].id,
                day_id=day.id,
                position_id=position.id,
                hall_id=hall.id if hall else None,
                information="",
                attendance=attendance,
            )

        alice_day1 = assign("alice", day1, registration, hall, Attendance.YES)
        alice_day2 = assign("alice", day2, registration, None, Attendance.UNKNOWN)
        session.add_all(
            [
                alice_day1,
                alice_day2,
                assign("bob", day1, hall_position, hall, Attendance.NO),
                assign("carol", day2, registration, None, Attendance.UNKNOWN),
            ]
        )
        await session.commit()
        return Seed(
            year_id=year.id,
            admin_id=admin.id,
            day1_id=day1.id,
            day2_id=day2.id,
            registration_id=registration.id,
            hall_position_id=hall_position.id,
            hall_id=hall.id,
            alice_form_id=forms["alice"].id,
            bob_form_id=forms["bob"].id,
            carol_form_id=forms["carol"].id,
            dave_form_id=forms["dave"].id,
            alice_day1_id=alice_day1.id,
            alice_day2_id=alice_day2.id,
        )


def draft(template: str = "Hello, {{ user.first_name_en }}!", **kwargs: object) -> MailingDraft:
    return MailingDraft(title="Test", template=template, **kwargs)  # type: ignore[arg-type]


async def recipients(
    service: MailingService, seed: Seed, d: MailingDraft
) -> dict[int, list[int | None]]:
    """Form id -> assignments of its messages."""
    plan = await service.get_recipients(seed.year_id, d)
    return {
        r.form.id: [ud.id if ud else None for ud in r.message_assignments] for r in plan.recipients
    }


async def start(service: MailingService, seed: Seed, d: MailingDraft) -> int:
    mailing = await service.create_draft(seed.year_id, seed.admin_id)
    await service.update_draft(mailing.id, d)
    await service.start(mailing.id, seed.admin_id)
    return mailing.id


async def messages(service: MailingService, mailing_id: int) -> dict[int | None, MailingMessage]:
    """Form id -> message (one message per form in these tests)."""
    return {m.application_form_id: m for m in await service.get_messages(mailing_id)}


# --- Recipients ---


async def test_without_filter_all_forms_of_the_year_get_a_message(
    service: MailingService, seed: Seed
) -> None:
    plan = await service.get_recipients(seed.year_id, draft())

    assert {r.form.id: r.message_assignments for r in plan.recipients} == {
        seed.alice_form_id: [None],
        seed.bob_form_id: [None],
        seed.carol_form_id: [None],
        seed.dave_form_id: [None],
    }
    assert plan.messages == 3
    assert plan.skipped_messages == 1  # carol has no Telegram
    assert not plan.uses_assignment


async def test_filter_conditions_apply_to_the_same_assignment(
    service: MailingService, seed: Seed
) -> None:
    # Bob is at the hall position only on day 1, Alice is on registration on day 2
    by_day_and_position = draft(
        filter=MailingFilter(day_ids=[seed.day2_id], position_ids=[seed.hall_position_id])
    )
    assert await recipients(service, seed, by_day_and_position) == {}

    day2_registration = draft(
        filter=MailingFilter(day_ids=[seed.day2_id], position_ids=[seed.registration_id])
    )
    assert set(await recipients(service, seed, day2_registration)) == {
        seed.alice_form_id,
        seed.carol_form_id,
    }

    absent_on_day1 = draft(
        filter=MailingFilter(day_ids=[seed.day1_id], attendance=[Attendance.NO, Attendance.SICK])
    )
    assert set(await recipients(service, seed, absent_on_day1)) == {seed.bob_form_id}


async def test_hall_filter_with_and_without_hall(service: MailingService, seed: Seed) -> None:
    in_hall = draft(filter=MailingFilter(hall_ids=[seed.hall_id]))
    assert set(await recipients(service, seed, in_hall)) == {seed.alice_form_id, seed.bob_form_id}

    without_hall = draft(filter=MailingFilter(no_hall=True))
    assert set(await recipients(service, seed, without_hall)) == {
        seed.alice_form_id,
        seed.carol_form_id,
    }


async def test_several_assignments_give_one_message_unless_the_template_uses_them(
    service: MailingService, seed: Seed
) -> None:
    registration = MailingFilter(position_ids=[seed.registration_id])

    plain = await recipients(service, seed, draft(filter=registration))
    assert plain[seed.alice_form_id] == [None]

    first = await recipients(
        service, seed, draft("{{ day.name }}", filter=registration, assignment_mode="first")
    )
    assert first[seed.alice_form_id] == [seed.alice_day1_id]

    in_button = draft(
        filter=registration,
        assignment_mode=AssignmentMode.ALL,
        buttons=[MailingButton(text="Day", url="https://x.example/{{ assignment.day.id }}")],
    )
    plan = await service.get_recipients(seed.year_id, in_button)
    assert plan.uses_assignment
    assert plan.has_unpublished_days  # day 2
    assert {r.form.id: [ud.id for ud in r.message_assignments if ud] for r in plan.recipients}[
        seed.alice_form_id
    ] == [seed.alice_day1_id, seed.alice_day2_id]


async def test_excluded_forms_are_listed_but_get_no_messages(
    service: MailingService, seed: Seed
) -> None:
    plan = await service.get_recipients(seed.year_id, draft(excluded_form_ids=[seed.alice_form_id]))

    assert {r.form.id for r in plan.recipients if r.excluded} == {seed.alice_form_id}
    assert plan.messages == 2


# --- Rendering ---


async def test_preview_renders_the_context_and_escapes_values_in_text_only(
    service: MailingService, seed: Seed
) -> None:
    d = draft(
        "{{ user.first_name_ru }}: {{ day.name }}, {{ position.name }}"
        "{% if hall %} in {{ hall.name }}{% endif %} ({{ assignment.attendance }}, "
        "{{ form.itmo_group }}, {{ year.year_name }})",
        filter=MailingFilter(position_ids=[seed.registration_id]),
        buttons=[MailingButton(text="{{ user.first_name_ru }}", url="https://x.example/?a=1&b=2")],
    )

    message = await service.preview(seed.year_id, d, seed.alice_form_id, seed.alice_day1_id)
    assert message.errors == []
    assert message.text == "Alice: Day 1, Registration in Main hall (yes, M3100, 2026)"

    dave = await service.preview(
        seed.year_id, draft("{{ user.first_name_ru }}"), seed.dave_form_id, None
    )
    assert dave.text == "Dave &lt;3"

    d.buttons[0].text = "{{ user.first_name_ru }}"
    d.filter = MailingFilter()
    d.template = "Hi"
    with_button = await service.preview(seed.year_id, d, seed.dave_form_id, None)
    assert with_button.buttons[0].text == "Dave <3"
    assert with_button.buttons[0].url == "https://x.example/?a=1&b=2"


async def test_confirm_url_can_be_built_from_the_year_and_the_day(
    service: MailingService, seed: Seed
) -> None:
    d = draft(
        "Will you come?",
        filter=MailingFilter(day_ids=[seed.day1_id]),
        buttons=[
            MailingButton(
                text="Yes",
                url="https://volunteers.example/{{ year.id }}/days/{{ day.id }}/confirm",
            )
        ],
    )

    message = await service.preview(seed.year_id, d, seed.alice_form_id, seed.alice_day1_id)
    assert message.errors == []
    assert message.buttons[0].url == (
        f"https://volunteers.example/{seed.year_id}/days/{seed.day1_id}/confirm"
    )


async def test_undefined_variables_and_invalid_html_are_errors(
    service: MailingService, seed: Seed
) -> None:
    typo = await service.preview(
        seed.year_id, draft("{{ user.frist_name }}"), seed.bob_form_id, None
    )
    assert [e.field for e in typo.errors] == ["text"]

    no_assignment = await service.preview(
        seed.year_id, draft("{{ day.name }}"), seed.bob_form_id, None
    )
    assert no_assignment.errors

    html = await service.preview(
        seed.year_id, draft("<div>{{ user.first_name_en }}</div>"), seed.bob_form_id, None
    )
    assert html.errors[0].message == "Unsupported tag <div>"

    button = await service.preview(
        seed.year_id,
        draft(buttons=[MailingButton(text=" ", url="javascript:alert(1)")]),
        seed.bob_form_id,
        None,
    )
    assert [(e.field, e.button) for e in button.errors] == [("button_text", 0), ("button_url", 0)]


# --- Start ---


async def test_start_is_rejected_with_errors_and_records_nothing(
    service: MailingService, seed: Seed
) -> None:
    mailing = await service.create_draft(seed.year_id, seed.admin_id)
    await service.update_draft(mailing.id, draft("<b>{{ user.first_name_en }}"))

    with pytest.raises(MailingInvalid) as e:
        await service.start(mailing.id, seed.admin_id)

    assert {error.form_id for error in e.value.errors} == {
        seed.alice_form_id,
        seed.bob_form_id,
        seed.dave_form_id,
    }
    assert (await service.get_mailing(mailing.id)).status == MailingStatus.DRAFT
    assert await service.get_messages(mailing.id) == []


async def test_errors_of_recipients_without_telegram_do_not_block_the_start(
    service: MailingService, seed: Seed
) -> None:
    # Only Carol has no Telegram username, and no Telegram account
    mailing_id = await start(service, seed, draft("{{ user.telegram_username.upper() }}"))

    by_form = await messages(service, mailing_id)
    assert by_form[seed.alice_form_id].text == "ALICE"
    assert by_form[seed.carol_form_id].status == MailingMessageStatus.SKIPPED


async def test_start_without_recipients_with_telegram_is_rejected(
    service: MailingService, seed: Seed
) -> None:
    mailing = await service.create_draft(seed.year_id, seed.admin_id)
    await service.update_draft(
        mailing.id,
        draft(excluded_form_ids=[seed.alice_form_id, seed.bob_form_id, seed.dave_form_id]),
    )
    with pytest.raises(MailingNoRecipients):
        await service.start(mailing.id, seed.admin_id)


async def test_started_mailing_is_frozen(
    engine: AsyncEngine,
    service: MailingService,
    worker: MailingWorker,
    sender: FakeSender,
    seed: Seed,
) -> None:
    d = draft("{{ position.name }}", filter=MailingFilter(day_ids=[seed.day1_id]))
    mailing_id = await start(service, seed, d)

    with pytest.raises(MailingNotDraft):
        await service.update_draft(mailing_id, d)
    with pytest.raises(MailingNotDraft):
        await service.delete_draft(mailing_id)

    async with engine.begin() as conn:
        await conn.execute(
            update(UserDay)
            .where(UserDay.id == seed.alice_day1_id)
            .values(position_id=seed.hall_position_id)
        )
    await worker.run_once()

    assert (ALICE, "Registration", []) in sender.sent


# --- Delivery ---


async def test_messages_are_sent_and_the_admins_are_notified(
    service: MailingService,
    worker: MailingWorker,
    sender: FakeSender,
    notifier: FakeNotifier,
    seed: Seed,
) -> None:
    d = draft(buttons=[MailingButton(text="Open", url="https://x.example/")])
    mailing_id = await start(service, seed, d)

    assert await worker.run_once()

    assert sorted(sender.chats()) == [ALICE, BOB, DAVE]
    assert (ALICE, "Hello, Alice!", [{"text": "Open", "url": "https://x.example/"}]) in sender.sent
    by_form = await messages(service, mailing_id)
    assert by_form[seed.alice_form_id].status == MailingMessageStatus.SENT
    assert by_form[seed.alice_form_id].telegram_message_id is not None
    assert by_form[seed.carol_form_id].status == MailingMessageStatus.SKIPPED
    mailing = await service.get_mailing(mailing_id)
    assert mailing.status == MailingStatus.DONE
    assert mailing.finished_at is not None
    assert notifier.messages == [
        "Mailing «Test» finished: sent 3, skipped 1\n(by Admin Adams)\n"
        f"https://volunteers.example/{seed.year_id}/mailings/{mailing_id}"
    ]


async def test_telegram_errors_are_classified(
    service: MailingService, worker: MailingWorker, sender: FakeSender, seed: Seed
) -> None:
    sender.errors = {
        ALICE: [TelegramRetryAfter(METHOD, "Too Many Requests", retry_after=0)],
        BOB: [TelegramForbiddenError(METHOD, "bot was blocked by the user")],
        DAVE: [TelegramNetworkError(METHOD, "Request timeout error")],
    }
    mailing_id = await start(service, seed, draft())

    await worker.run_once()

    by_form = await messages(service, mailing_id)
    assert by_form[seed.alice_form_id].status == MailingMessageStatus.SENT
    assert by_form[seed.bob_form_id].status == MailingMessageStatus.FAILED
    assert "blocked" in (by_form[seed.bob_form_id].error or "")
    assert by_form[seed.dave_form_id].status == MailingMessageStatus.UNKNOWN
    assert sender.chats() == [ALICE]


async def test_server_errors_are_unknown(
    service: MailingService, worker: MailingWorker, sender: FakeSender, seed: Seed
) -> None:
    sender.errors = {ALICE: [TelegramServerError(METHOD, "Bad Gateway")]}
    mailing_id = await start(service, seed, draft())

    await worker.run_once()

    assert (await messages(service, mailing_id))[
        seed.alice_form_id
    ].status == MailingMessageStatus.UNKNOWN


async def test_messages_interrupted_by_a_dead_sender_are_not_sent_again(
    engine: AsyncEngine,
    service: MailingService,
    worker: MailingWorker,
    sender: FakeSender,
    seed: Seed,
) -> None:
    mailing_id = await start(service, seed, draft())
    # The previous sender died after handing Alice's message to Telegram
    async with engine.begin() as conn:
        await conn.execute(update(Mailing).values(status=MailingStatus.SENDING))
        await conn.execute(
            update(MailingMessage)
            .where(MailingMessage.application_form_id == seed.alice_form_id)
            .values(status=MailingMessageStatus.SENDING)
        )

    await worker.run_once()

    assert sorted(sender.chats()) == [BOB, DAVE]
    assert (await messages(service, mailing_id))[
        seed.alice_form_id
    ].status == MailingMessageStatus.UNKNOWN
    assert (await service.get_mailing(mailing_id)).status == MailingStatus.DONE


async def test_only_one_sender_runs(
    engine: AsyncEngine,
    service: MailingService,
    worker: MailingWorker,
    sender: FakeSender,
    seed: Seed,
) -> None:
    await start(service, seed, draft())

    async with engine.connect() as other_sender:
        await other_sender.execute(select(text(f"pg_advisory_lock({SENDER_LOCK_KEY})")))
        assert not await worker.run_once()
        await other_sender.execute(select(text(f"pg_advisory_unlock({SENDER_LOCK_KEY})")))
        await other_sender.commit()

    assert sender.sent == []
    assert await worker.run_once()
    assert len(sender.sent) == 3


async def test_cancelled_mailing_sends_nothing(
    service: MailingService, worker: MailingWorker, sender: FakeSender, seed: Seed
) -> None:
    mailing_id = await start(service, seed, draft())

    await service.cancel(mailing_id)
    await worker.run_once()

    assert sender.sent == []
    assert (await service.get_mailing(mailing_id)).status == MailingStatus.CANCELLED
    statuses = {m.status for m in await service.get_messages(mailing_id)}
    assert statuses == {MailingMessageStatus.CANCELLED, MailingMessageStatus.SKIPPED}
    with pytest.raises(MailingNotCancellable):
        await service.cancel(mailing_id)


async def test_failed_and_unknown_messages_can_be_resent(
    service: MailingService, worker: MailingWorker, sender: FakeSender, seed: Seed
) -> None:
    sender.errors = {
        BOB: [TelegramForbiddenError(METHOD, "bot was blocked by the user")],
        DAVE: [TelegramNetworkError(METHOD, "Request timeout error")],
    }
    mailing_id = await start(service, seed, draft())
    await worker.run_once()
    by_form = await messages(service, mailing_id)

    mailing = await service.resend(
        mailing_id,
        [
            by_form[seed.alice_form_id].id,
            by_form[seed.bob_form_id].id,
            by_form[seed.dave_form_id].id,
        ],
    )
    assert mailing.status == MailingStatus.QUEUED
    await worker.run_once()

    # Alice's message was already sent and is not resent
    assert sorted(sender.chats()) == [ALICE, BOB, DAVE]
    assert {m.status for m in await service.get_messages(mailing_id)} == {
        MailingMessageStatus.SENT,
        MailingMessageStatus.SKIPPED,
    }
    assert (await service.get_mailing(mailing_id)).status == MailingStatus.DONE


async def test_mailings_are_sent_in_the_order_they_were_started(
    service: MailingService, worker: MailingWorker, sender: FakeSender, seed: Seed
) -> None:
    await start(service, seed, draft("first"))
    await start(service, seed, draft("second"))

    await worker.run_once()

    assert [text for _, text, _ in sender.sent] == ["first"] * 3 + ["second"] * 3


# --- Drafts and test messages ---


async def test_clone_copies_the_draft(service: MailingService, seed: Seed) -> None:
    d = draft(
        "{{ day.name }}",
        filter=MailingFilter(day_ids=[seed.day1_id]),
        excluded_form_ids=[seed.bob_form_id],
        buttons=[MailingButton(text="a", url="https://b.example/")],
        assignment_mode=AssignmentMode.ALL,
    )
    mailing_id = await start(service, seed, d)

    clone = await service.create_draft(seed.year_id, seed.admin_id, mailing_id)

    assert clone.status == MailingStatus.DRAFT
    assert clone.template == d.template
    assert clone.filter == d.filter.model_dump(mode="json")
    assert clone.excluded_form_ids == [seed.bob_form_id]
    assert clone.buttons == [{"text": "a", "url": "https://b.example/"}]
    assert clone.assignment_mode == AssignmentMode.ALL


async def test_draft_can_be_deleted(service: MailingService, seed: Seed) -> None:
    mailing = await service.create_draft(seed.year_id, seed.admin_id)
    await service.delete_draft(mailing.id)
    assert await service.get_mailings(seed.year_id) == []


async def test_test_message_goes_to_the_admin_only(
    engine: AsyncEngine, service: MailingService, sender: FakeSender, seed: Seed
) -> None:
    await service.test_send(seed.year_id, draft(), seed.alice_form_id, None, seed.admin_id)

    assert sender.sent == [(ADMIN, "Hello, Alice!", [])]
    async with engine.connect() as conn:
        assert (await conn.execute(select(MailingMessage))).first() is None

    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM user_identities WHERE subject = :s"), {"s": str(ADMIN)}
        )
    with pytest.raises(MailingAdminWithoutTelegram):
        await service.test_send(seed.year_id, draft(), seed.alice_form_id, None, seed.admin_id)
