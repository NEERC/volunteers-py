import os
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from volunteers.models import (
    ApplicationForm,
    Assessment,
    Day,
    ExtraExperience,
    FormPositionAssociation,
    Gender,
    IdentityProvider,
    Position,
    User,
    UserDay,
    UserIdentity,
    Year,
)
from volunteers.models.base import metadata
from volunteers.services.user_merge import (
    MergeWithItself,
    UnresolvedFormConflict,
    UnresolvedIdentityConflict,
    UserMergeService,
    merge_user_fields,
)

# Admin URL of a Postgres server, e.g. postgresql+asyncpg://postgres:postgres@localhost:5432/postgres.
# A temporary database is created on it for every test.
TEST_DATABASE_URL = os.environ.get("VOLUNTEERS_TEST_DATABASE_URL")


def make_user(**kwargs: object) -> User:
    fields: dict[str, object] = {
        "first_name_ru": "Иван",
        "last_name_ru": "Иванов",
        "first_name_en": "Ivan",
        "last_name_en": "Ivanov",
        "is_admin": False,
    }
    fields.update(kwargs)
    return User(**fields)


def test_merge_user_fields_prefers_target_and_fills_empty_fields() -> None:
    target = make_user(
        id=1, patronymic_ru=None, phone="  ", email="old@example.com", gender=None, isu_id=None
    )
    source = make_user(
        id=2,
        first_name_ru="Ваня",
        patronymic_ru="Петрович",
        phone="+7999",
        email="new@example.com",
        gender=Gender.MALE,
        isu_id=123456,
        telegram_username="ivan",
        is_admin=True,
    )

    fields = merge_user_fields(target, source)

    assert fields["first_name_ru"] == "Иван"
    assert fields["email"] == "old@example.com"
    assert fields["patronymic_ru"] == "Петрович"
    assert fields["phone"] == "+7999"
    assert fields["gender"] == Gender.MALE
    assert fields["isu_id"] == 123456
    assert fields["telegram_username"] == "ivan"
    assert fields["is_admin"] is True


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
def service(engine: AsyncEngine) -> UserMergeService:
    service = UserMergeService()
    service.db = engine
    return service


@dataclass
class Seed:
    old_user_id: int
    new_user_id: int
    other_user_id: int
    year1_id: int
    year2_id: int
    old_form1_id: int
    new_form1_id: int
    new_form2_id: int
    old_telegram_id: int
    new_telegram_id: int
    new_legacy_id: int


async def seed(engine: AsyncEngine) -> Seed:
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        year1 = Year(year_name="2025", open_for_registration=False)
        year2 = Year(year_name="2026", open_for_registration=True)
        session.add_all([year1, year2])
        await session.flush()
        day1 = Day(year_id=year1.id, name="Day 1", information="")
        day2 = Day(year_id=year2.id, name="Day 2", information="")
        position1 = Position(year_id=year1.id, name="Runner", can_desire=True)
        position2 = Position(year_id=year2.id, name="Helper", can_desire=True)
        session.add_all([day1, day2, position1, position2])

        old_user = make_user(email="old@example.com", phone=None)
        new_user = make_user(email="new@example.com", phone="+7999", is_admin=True)
        other_user = make_user(first_name_ru="Пётр", last_name_ru="Петров")
        session.add_all([old_user, new_user, other_user])
        await session.flush()

        old_form1 = ApplicationForm(year_id=year1.id, user_id=old_user.id, comments="old")
        new_form1 = ApplicationForm(year_id=year1.id, user_id=new_user.id, comments="new")
        new_form2 = ApplicationForm(year_id=year2.id, user_id=new_user.id, comments="new 2")
        session.add_all([old_form1, new_form1, new_form2])
        await session.flush()
        session.add_all(
            [
                FormPositionAssociation(
                    form_id=old_form1.id, position_id=position1.id, year_id=year1.id
                ),
                FormPositionAssociation(
                    form_id=new_form1.id, position_id=position1.id, year_id=year1.id
                ),
                ExtraExperience(application_form_id=old_form1.id, value=1.0),
            ]
        )

        old_user_day = UserDay(
            application_form_id=old_form1.id,
            day_id=day1.id,
            position_id=position1.id,
            information="",
        )
        new_user_day = UserDay(
            application_form_id=new_form1.id,
            day_id=day1.id,
            position_id=position1.id,
            information="",
        )
        session.add_all([old_user_day, new_user_day])
        await session.flush()
        session.add_all(
            [
                Assessment(user_day_id=old_user_day.id, comment="old", value=1, author_id=None),
                Assessment(
                    user_day_id=new_user_day.id, comment="new", value=2, author_id=new_user.id
                ),
            ]
        )

        old_telegram = UserIdentity(
            user_id=old_user.id, provider=IdentityProvider.TELEGRAM, subject="1"
        )
        new_telegram = UserIdentity(
            user_id=new_user.id, provider=IdentityProvider.TELEGRAM, subject="2"
        )
        new_legacy = UserIdentity(
            user_id=new_user.id, provider=IdentityProvider.LEGACY, subject="new@example.com"
        )
        session.add_all([old_telegram, new_telegram, new_legacy])
        await session.commit()

        return Seed(
            old_user_id=old_user.id,
            new_user_id=new_user.id,
            other_user_id=other_user.id,
            year1_id=year1.id,
            year2_id=year2.id,
            old_form1_id=old_form1.id,
            new_form1_id=new_form1.id,
            new_form2_id=new_form2.id,
            old_telegram_id=old_telegram.id,
            new_telegram_id=new_telegram.id,
            new_legacy_id=new_legacy.id,
        )


async def count(session: AsyncSession, model: type, *where: object) -> int:
    result = await session.execute(select(func.count()).select_from(model).where(*where))  # type: ignore[arg-type]
    return result.scalar_one()


async def test_plan_reports_conflicts(engine: AsyncEngine, service: UserMergeService) -> None:
    s = await seed(engine)

    # The order of the arguments does not matter: the older user is always the target
    plan = await service.plan_merge(s.new_user_id, s.old_user_id)

    assert plan.target.id == s.old_user_id
    assert plan.source.id == s.new_user_id
    assert [(c.year_id, [f.id for f in c.forms]) for c in plan.form_conflicts] == [
        (s.year1_id, [s.old_form1_id, s.new_form1_id])
    ]
    assert [(c.provider, [i.id for i in c.identities]) for c in plan.identity_conflicts] == [
        (IdentityProvider.TELEGRAM, [s.old_telegram_id, s.new_telegram_id])
    ]
    assert plan.merged_fields["email"] == "old@example.com"
    assert plan.merged_fields["phone"] == "+7999"
    assert plan.merged_fields["is_admin"] is True


async def test_merge_requires_resolutions(engine: AsyncEngine, service: UserMergeService) -> None:
    s = await seed(engine)

    with pytest.raises(MergeWithItself):
        await service.merge(s.old_user_id, s.old_user_id, {}, {})
    with pytest.raises(UnresolvedFormConflict):
        await service.merge(
            s.old_user_id, s.new_user_id, {}, {IdentityProvider.TELEGRAM: s.old_telegram_id}
        )
    with pytest.raises(UnresolvedIdentityConflict):
        await service.merge(
            s.old_user_id,
            s.new_user_id,
            {s.year1_id: s.old_form1_id},
            {IdentityProvider.TELEGRAM: -1},
        )

    async with async_sessionmaker(engine)() as session:
        assert await count(session, User) == 3


async def test_merge_moves_everything_to_the_older_user(
    engine: AsyncEngine, service: UserMergeService
) -> None:
    s = await seed(engine)

    target_id = await service.merge(
        s.new_user_id,
        s.old_user_id,
        kept_form_ids={s.year1_id: s.new_form1_id},
        kept_identity_ids={IdentityProvider.TELEGRAM: s.new_telegram_id},
    )

    assert target_id == s.old_user_id
    async with async_sessionmaker(engine)() as session:
        assert await session.get(User, s.new_user_id) is None
        user = await session.get(User, s.old_user_id)
        assert user is not None
        assert user.email == "old@example.com"
        assert user.phone == "+7999"
        assert user.is_admin is True

        forms = (
            await session.execute(
                select(ApplicationForm.id, ApplicationForm.user_id).order_by(ApplicationForm.id)
            )
        ).all()
        assert [tuple(f) for f in forms] == [
            (s.new_form1_id, s.old_user_id),
            (s.new_form2_id, s.old_user_id),
        ]
        # Everything attached to the dropped form is gone
        assert await count(session, UserDay) == 1
        assert await count(session, Assessment) == 1
        assert await count(session, ExtraExperience) == 0
        assert await count(session, FormPositionAssociation) == 1
        assert await count(session, Assessment, Assessment.author_id == s.old_user_id) == 1

        identities = (
            await session.execute(
                select(UserIdentity.id, UserIdentity.user_id).order_by(UserIdentity.id)
            )
        ).all()
        assert [tuple(i) for i in identities] == [
            (s.new_telegram_id, s.old_user_id),
            (s.new_legacy_id, s.old_user_id),
        ]
