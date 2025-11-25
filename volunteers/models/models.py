from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Double,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .attendance import Attendance
from .base import Base, TimestampMixin


class Year(Base, TimestampMixin):
    __tablename__ = "years"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_name: Mapped[str] = mapped_column(String)
    open_for_registration: Mapped[bool] = mapped_column(Boolean)

    application_forms: Mapped[set[ApplicationForm]] = relationship(
        back_populates="year", cascade="all, delete-orphan"
    )

    days: Mapped[set[Day]] = relationship(back_populates="year", cascade="all, delete-orphan")
    halls: Mapped[set[Hall]] = relationship(back_populates="year", cascade="all, delete-orphan")


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)

    isu_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_name_ru: Mapped[str] = mapped_column(String)
    last_name_ru: Mapped[str] = mapped_column(String)
    patronymic_ru: Mapped[str | None] = mapped_column(String, nullable=True)
    first_name_en: Mapped[str] = mapped_column(String)
    last_name_en: Mapped[str] = mapped_column(String)

    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String, nullable=True)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    application_forms: Mapped[set[ApplicationForm]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class ApplicationForm(Base, TimestampMixin):
    __tablename__ = "application_forms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    year: Mapped[Year] = relationship(back_populates="application_forms")

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped[User] = relationship(back_populates="application_forms")

    itmo_group: Mapped[str | None] = mapped_column(String, default="", nullable=True)
    comments: Mapped[str] = mapped_column(String, default="")
    needs_invitation: Mapped[bool] = mapped_column(Boolean, default=False)

    desired_positions: Mapped[set[Position]] = relationship(
        secondary="application_form_position_association",
        collection_class=set,
    )

    user_days: Mapped[set[UserDay]] = relationship(
        back_populates="application_form", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("year_id", "user_id", name="application_forms_unique_year_id_user_id"),
    )


class Position(Base, TimestampMixin):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    name: Mapped[str] = mapped_column(String, unique=True)
    can_desire: Mapped[bool] = mapped_column(Boolean, default=False)
    has_halls: Mapped[bool] = mapped_column(Boolean, default=False)
    is_manager: Mapped[bool] = mapped_column(Boolean, default=False)

    user_days: Mapped[set[UserDay]] = relationship(
        back_populates="position", cascade="all, delete-orphan"
    )


class FormPositionAssociation(Base, TimestampMixin):
    __tablename__ = "application_form_position_association"
    form_id: Mapped[int] = mapped_column(ForeignKey("application_forms.id"), primary_key=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"), primary_key=True)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))


class Day(Base, TimestampMixin):
    __tablename__ = "days"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    year: Mapped[Year] = relationship(back_populates="days")

    name: Mapped[str] = mapped_column(String)
    information: Mapped[str] = mapped_column(String)

    score: Mapped[float] = mapped_column(
        Double, nullable=True
    )  # Day score. Should be not null for scores to compute.
    mandatory: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )  # Whether the day should be included in the score computation.
    assignment_published: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )  # Whether the day's assignments are published and visible to users.

    user_days: Mapped[set[UserDay]] = relationship(
        back_populates="day", cascade="all, delete-orphan"
    )


class Hall(Base, TimestampMixin):
    __tablename__ = "halls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    year: Mapped[Year] = relationship(back_populates="halls")

    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    user_days: Mapped[set[UserDay]] = relationship(
        back_populates="hall", cascade="all, delete-orphan"
    )


class UserDay(Base, TimestampMixin):
    __tablename__ = "user_days"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    application_form_id: Mapped[int] = mapped_column(ForeignKey("application_forms.id"))
    application_form: Mapped[ApplicationForm] = relationship(back_populates="user_days")

    day_id: Mapped[int] = mapped_column(ForeignKey("days.id"))
    day: Mapped[Day] = relationship(back_populates="user_days")

    __table_args__ = (
        UniqueConstraint("application_form_id", "day_id", name="uq_user_day_application_form_day"),
    )

    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"))
    position: Mapped[Position] = relationship(back_populates="user_days")

    hall_id: Mapped[int | None] = mapped_column(ForeignKey("halls.id"), nullable=True)
    hall: Mapped[Hall | None] = relationship(back_populates="user_days")

    information: Mapped[str] = mapped_column(String)  # no idea why it's here or what it's used for
    attendance: Mapped[Attendance] = mapped_column(
        Enum(Attendance, name="attendance_enum"), default=Attendance.UNKNOWN
    )

    assessments: Mapped[set[Assessment]] = relationship(
        back_populates="user_day", cascade="all, delete-orphan"
    )


class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_day_id: Mapped[int] = mapped_column(ForeignKey("user_days.id"))
    user_day: Mapped[UserDay] = relationship(back_populates="assessments")

    comment: Mapped[str] = mapped_column(String)
    value: Mapped[float] = mapped_column(Double)


class LegacyUser(Base):
    __tablename__ = "legacy_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    new_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    new_user: Mapped[User] = relationship()

    email: Mapped[str] = mapped_column(String)
    password: Mapped[str] = mapped_column(String)
