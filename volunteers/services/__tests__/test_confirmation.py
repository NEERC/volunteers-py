import os
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from volunteers.models import (
    ApplicationForm,
    Attendance,
    Day,
    Hall,
    Position,
    User,
    UserDay,
    Year,
)
from volunteers.models.base import metadata
from volunteers.schemas.day_assignment import ConfirmationState
from volunteers.schemas.user_day import UserDayEditIn
from volunteers.services.year import (
    AssignmentsNotPublished,
    DayNotFound,
    NotAssignedToDay,
    YearService,
)

# Admin URL of a Postgres server, e.g. postgresql+asyncpg://postgres:postgres@localhost:5432/postgres.
# A temporary database is created on it for every test.
TEST_DATABASE_URL = os.environ.get("VOLUNTEERS_TEST_DATABASE_URL")


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
def service(engine: AsyncEngine) -> YearService:
    socketio_server = MagicMock()
    socketio_server.emit = AsyncMock()
    service = YearService(notifier=AsyncMock(), socketio_server=socketio_server)
    service.db = engine
    return service


@dataclass
class Seed:
    year_id: int
    other_year_id: int
    # Published, mandatory
    day1_id: int
    # Not published
    day2_id: int
    registration_id: int
    hall_position_id: int
    hall_a_id: int
    hall_b_id: int
    admin: User
    # Manager of hall A on day 1
    manager: User
    # Day 1: registration without a hall, unknown; day 2: registration, unknown
    alice: User
    # Day 1: hall position in hall A, unknown
    bob: User
    # Day 1: hall position in hall B, confirmed
    carol: User
    # Registered, no assignments
    dave: User
    alice_day1_id: int
    bob_day1_id: int
    carol_day1_id: int


def make_user(name: str, is_admin: bool = False) -> User:
    return User(
        first_name_ru=name,
        last_name_ru=name,
        first_name_en=name,
        last_name_en=name,
        is_admin=is_admin,
    )


@pytest.fixture
async def seed(engine: AsyncEngine) -> Seed:
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        year = Year(year_name="2026", open_for_registration=True)
        other_year = Year(year_name="2025", open_for_registration=False)
        session.add_all([year, other_year])
        await session.flush()
        day1 = Day(
            year_id=year.id,
            name="Day 1",
            information="Come at 9:00",
            assignment_published=True,
            mandatory=True,
            score=10.0,
        )
        day2 = Day(year_id=year.id, name="Day 2", information="", assignment_published=False)
        registration = Position(year_id=year.id, name="Registration")
        hall_position = Position(year_id=year.id, name="Hall", has_halls=True)
        manager_position = Position(
            year_id=year.id, name="Manager", has_halls=True, is_manager=True
        )
        hall_a = Hall(year_id=year.id, name="Hall A")
        hall_b = Hall(year_id=year.id, name="Hall B")
        session.add_all([day1, day2, registration, hall_position, manager_position, hall_a, hall_b])

        users = {
            name: make_user(name, is_admin=name == "admin")
            for name in ("admin", "manager", "alice", "bob", "carol", "dave")
        }
        session.add_all(users.values())
        await session.flush()
        forms = {
            name: ApplicationForm(year_id=year.id, user_id=user.id)
            for name, user in users.items()
            if name != "admin"
        }
        session.add_all(forms.values())
        await session.flush()

        def assign(
            form: str,
            day: Day,
            position: Position,
            hall: Hall | None = None,
            attendance: Attendance = Attendance.UNKNOWN,
        ) -> UserDay:
            user_day = UserDay(
                application_form_id=forms[form].id,
                day_id=day.id,
                position_id=position.id,
                hall_id=hall.id if hall else None,
                information="",
                attendance=attendance,
            )
            session.add(user_day)
            return user_day

        assign("manager", day1, manager_position, hall_a)
        alice_day1 = assign("alice", day1, registration)
        assign("alice", day2, registration)
        bob_day1 = assign("bob", day1, hall_position, hall_a)
        carol_day1 = assign("carol", day1, hall_position, hall_b, Attendance.CONFIRMED)
        await session.commit()
        return Seed(
            year_id=year.id,
            other_year_id=other_year.id,
            day1_id=day1.id,
            day2_id=day2.id,
            registration_id=registration.id,
            hall_position_id=hall_position.id,
            hall_a_id=hall_a.id,
            hall_b_id=hall_b.id,
            admin=users["admin"],
            manager=users["manager"],
            alice=users["alice"],
            bob=users["bob"],
            carol=users["carol"],
            dave=users["dave"],
            alice_day1_id=alice_day1.id,
            bob_day1_id=bob_day1.id,
            carol_day1_id=carol_day1.id,
        )


async def attendance(engine: AsyncEngine, user_day_id: int) -> Attendance:
    async with async_sessionmaker(engine)() as session:
        user_day = await session.scalar(select(UserDay).where(UserDay.id == user_day_id))
        assert user_day is not None
        return user_day.attendance


async def set_attendance(engine: AsyncEngine, user_day_id: int, value: Attendance) -> None:
    async with async_sessionmaker(engine)() as session:
        user_day = await session.scalar(select(UserDay).where(UserDay.id == user_day_id))
        assert user_day is not None
        user_day.attendance = value
        await session.commit()


# --- Confirmation page ---


async def test_confirmation_shows_the_assignment(service: YearService, seed: Seed) -> None:
    bob = await service.get_assignment_confirmation(seed.year_id, seed.day1_id, seed.bob.id)
    assert bob.state == ConfirmationState.ASSIGNED
    assert bob.day.name == "Day 1"
    assert bob.day.information == "Come at 9:00"
    assert bob.assignment is not None
    assert bob.assignment.position.name == "Hall"
    assert bob.assignment.hall is not None
    assert bob.assignment.hall.name == "Hall A"
    assert bob.assignment.attendance == Attendance.UNKNOWN

    alice = await service.get_assignment_confirmation(seed.year_id, seed.day1_id, seed.alice.id)
    assert alice.assignment is not None
    assert alice.assignment.hall is None


async def test_confirmation_without_an_assignment_or_publication(
    service: YearService, seed: Seed
) -> None:
    dave = await service.get_assignment_confirmation(seed.year_id, seed.day1_id, seed.dave.id)
    assert dave.state == ConfirmationState.NOT_ASSIGNED
    assert dave.assignment is None

    # Alice is assigned on day 2, but it is not published
    alice = await service.get_assignment_confirmation(seed.year_id, seed.day2_id, seed.alice.id)
    assert alice.state == ConfirmationState.NOT_PUBLISHED
    assert alice.assignment is None


async def test_confirmation_of_a_day_of_another_year_is_not_found(
    service: YearService, seed: Seed
) -> None:
    with pytest.raises(DayNotFound):
        await service.get_assignment_confirmation(seed.other_year_id, seed.day1_id, seed.bob.id)
    with pytest.raises(DayNotFound):
        await service.confirm_assignment(seed.other_year_id, seed.day1_id, seed.bob.id)


async def test_confirm_sets_confirmed(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    confirmation = await service.confirm_assignment(seed.year_id, seed.day1_id, seed.bob.id)

    assert confirmation.assignment is not None
    assert confirmation.assignment.attendance == Attendance.CONFIRMED
    assert await attendance(engine, seed.bob_day1_id) == Attendance.CONFIRMED
    # Other assignments are untouched
    assert await attendance(engine, seed.alice_day1_id) == Attendance.UNKNOWN


@pytest.mark.parametrize(
    "value",
    [Attendance.CONFIRMED, Attendance.YES, Attendance.NO, Attendance.LATE, Attendance.SICK],
)
async def test_confirm_keeps_a_set_attendance(
    service: YearService, engine: AsyncEngine, seed: Seed, value: Attendance
) -> None:
    await set_attendance(engine, seed.bob_day1_id, value)

    confirmation = await service.confirm_assignment(seed.year_id, seed.day1_id, seed.bob.id)

    assert confirmation.assignment is not None
    assert confirmation.assignment.attendance == value
    assert await attendance(engine, seed.bob_day1_id) == value


async def test_confirm_is_rejected_without_an_assignment_or_publication(
    service: YearService, seed: Seed
) -> None:
    with pytest.raises(NotAssignedToDay):
        await service.confirm_assignment(seed.year_id, seed.day1_id, seed.dave.id)
    with pytest.raises(AssignmentsNotPublished):
        await service.confirm_assignment(seed.year_id, seed.day2_id, seed.alice.id)


# --- Visibility of confirmations ---


async def confirmed_by_name(
    service: YearService, seed: Seed, viewer: User
) -> dict[str, bool | None]:
    day = await service.get_day_by_id(seed.day1_id)
    assert day is not None
    views = await service.get_day_assignments_for_viewer(day=day, viewer=viewer)
    return {view.assignment.application_form.user.first_name_en: view.confirmed for view in views}


async def test_admin_sees_all_confirmations(service: YearService, seed: Seed) -> None:
    assert await confirmed_by_name(service, seed, seed.admin) == {
        "manager": False,
        "alice": False,
        "bob": False,
        "carol": True,
    }


async def test_manager_sees_confirmations_of_their_halls(service: YearService, seed: Seed) -> None:
    assert await confirmed_by_name(service, seed, seed.manager) == {
        "manager": False,
        "alice": None,
        "bob": False,
        "carol": None,
    }


async def test_volunteer_sees_no_confirmations(service: YearService, seed: Seed) -> None:
    assert await confirmed_by_name(service, seed, seed.carol) == {
        "manager": None,
        "alice": None,
        "bob": None,
        "carol": None,
    }


async def test_admin_assignments_include_attendance(service: YearService, seed: Seed) -> None:
    assignments = await service.get_all_assignments_by_day_id(seed.day1_id)
    assert {a.id: a.attendance for a in assignments if a.id == seed.carol_day1_id} == {
        seed.carol_day1_id: Attendance.CONFIRMED
    }


# --- Changes of assignments ---


async def test_moving_an_assignment_keeps_confirmed(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    await service.edit_user_day_by_user_day_id(
        seed.carol_day1_id,
        UserDayEditIn(
            information=None,
            attendance=None,
            position_id=seed.hall_position_id,
            hall_id=seed.hall_a_id,
        ),
        author=seed.admin,
    )

    assert await attendance(engine, seed.carol_day1_id) == Attendance.CONFIRMED


async def test_copying_a_day_resets_confirmed_only(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    await set_attendance(engine, seed.bob_day1_id, Attendance.SICK)

    # Alice is already assigned on day 2 and is skipped
    await service.copy_assignments_from_day(seed.day1_id, seed.day2_id)

    async with async_sessionmaker(engine)() as session:
        copied = await session.scalars(
            select(UserDay).join(ApplicationForm).where(UserDay.day_id == seed.day2_id)
        )
        by_form = {user_day.application_form_id: user_day.attendance for user_day in copied}
    forms = await forms_by_user(engine, seed)
    assert by_form[forms[seed.carol.id]] == Attendance.UNKNOWN
    assert by_form[forms[seed.bob.id]] == Attendance.SICK


async def attendance_by_user(engine: AsyncEngine, day_id: int) -> dict[int, Attendance]:
    """User id -> attendance of their assignment on the day."""
    async with async_sessionmaker(engine)() as session:
        rows = await session.execute(
            select(ApplicationForm.user_id, UserDay.attendance)
            .join(UserDay)
            .where(UserDay.day_id == day_id)
        )
        return dict(rows.tuples().all())


async def prepare_day2(engine: AsyncEngine, seed: Seed, with_dave: bool = True) -> None:
    """Alice is sick on day 2, Dave is assigned on day 2 only."""
    async with async_sessionmaker(engine)() as session:
        alice_day2 = await session.scalar(
            select(UserDay)
            .join(ApplicationForm)
            .where(UserDay.day_id == seed.day2_id, ApplicationForm.user_id == seed.alice.id)
        )
        assert alice_day2 is not None
        alice_day2.attendance = Attendance.SICK
        if not with_dave:
            await session.commit()
            return
        dave_form = await session.scalar(
            select(ApplicationForm).where(ApplicationForm.user_id == seed.dave.id)
        )
        assert dave_form is not None
        session.add(
            UserDay(
                application_form_id=dave_form.id,
                day_id=seed.day2_id,
                position_id=seed.registration_id,
                information="",
                attendance=Attendance.UNKNOWN,
            )
        )
        await session.commit()


async def test_copying_skips_volunteers_assigned_on_the_target_day(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    await prepare_day2(engine, seed)

    copied = await service.copy_assignments_from_day(seed.day1_id, seed.day2_id)

    assert copied == 3
    day2 = await attendance_by_user(engine, seed.day2_id)
    assert set(day2) == {
        seed.manager.id,
        seed.alice.id,
        seed.bob.id,
        seed.carol.id,
        seed.dave.id,
    }
    assert day2[seed.alice.id] == Attendance.SICK


async def test_copying_overwrites_assignments_on_the_target_day(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    await prepare_day2(engine, seed)

    copied = await service.copy_assignments_from_day(
        seed.day1_id, seed.day2_id, overwrite_existing=True
    )

    assert copied == 4
    day2 = await attendance_by_user(engine, seed.day2_id)
    # Dave is not on day 1 and keeps his assignment
    assert set(day2) == {
        seed.manager.id,
        seed.alice.id,
        seed.bob.id,
        seed.carol.id,
        seed.dave.id,
    }
    assert day2[seed.alice.id] == Attendance.UNKNOWN


async def test_copying_replaces_all_assignments_on_the_target_day(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    await prepare_day2(engine, seed)

    copied = await service.copy_assignments_from_day(seed.day1_id, seed.day2_id, replace_all=True)

    assert copied == 4
    day2 = await attendance_by_user(engine, seed.day2_id)
    assert set(day2) == {seed.manager.id, seed.alice.id, seed.bob.id, seed.carol.id}
    assert day2[seed.alice.id] == Attendance.UNKNOWN


async def test_copying_replaces_a_conflicting_assignment_deleted_last(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    # Deleting another assignment after Alice's flushes her deletion by chance (loading its
    # assessments), so here her assignment is the only one on day 2
    await prepare_day2(engine, seed, with_dave=False)

    copied = await service.copy_assignments_from_day(seed.day1_id, seed.day2_id, replace_all=True)

    assert copied == 4
    day2 = await attendance_by_user(engine, seed.day2_id)
    assert day2[seed.alice.id] == Attendance.UNKNOWN


async def forms_by_user(engine: AsyncEngine, seed: Seed) -> dict[int, int]:
    async with async_sessionmaker(engine)() as session:
        forms = await session.scalars(
            select(ApplicationForm).where(ApplicationForm.year_id == seed.year_id)
        )
        return {form.user_id: form.id for form in forms}


# --- Experience ---


async def test_confirmed_gives_no_experience(
    service: YearService, engine: AsyncEngine, seed: Seed
) -> None:
    unknown_xp, _ = await service.calculate_year_xp(seed.year_id, seed.bob.id)
    await service.confirm_assignment(seed.year_id, seed.day1_id, seed.bob.id)

    confirmed_xp, _ = await service.calculate_year_xp(seed.year_id, seed.bob.id)
    assert confirmed_xp == unknown_xp

    await set_attendance(engine, seed.bob_day1_id, Attendance.YES)
    service.xp_cache.purge()
    yes_xp, _ = await service.calculate_year_xp(seed.year_id, seed.bob.id)
    assert yes_xp > confirmed_xp


async def test_confirmed_is_counted_in_attendance_stats(service: YearService, seed: Seed) -> None:
    [experience] = await service.get_user_experience(seed.carol.id)
    assert experience.attendance_stats == {Attendance.CONFIRMED: 1}
