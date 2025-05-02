from __future__ import annotations

from sqlalchemy import Boolean, Column, Double, Enum, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.attendance import Attendance
from volunteers.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True)
    password: Mapped[str] = mapped_column(String)
    telegram_id: Mapped[int] = mapped_column(Integer, unique=True)
    first_name: Mapped[str] = mapped_column(String)
    last_name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    applicationforms: Mapped[set[ApplicationForm]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Year(Base, TimestampMixin):
    __tablename__ = "years"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_name: Mapped[str] = mapped_column(String)
    openForRegistration: Mapped[bool] = mapped_column(Boolean)
    days: Mapped[list[Day]] = relationship(back_populates="year", cascade="all, delete-orphan")
    users: Mapped[set[ApplicationForm]] = relationship(
        back_populates="year", cascade="all, delete-orphan"
    )


class Day(Base, TimestampMixin):
    __tablename__ = "days"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_name: Mapped[str] = mapped_column(String)
    information: Mapped[str] = mapped_column(String)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    year: Mapped[Year] = relationship(back_populates="days")
    userdays: Mapped[set[UserDay]] = relationship(
        back_populates="day", cascade="all, delete-orphan"
    )


class UserDay(Base, TimestampMixin):
    __tablename__ = "userdays"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("days.id"))
    day: Mapped[Day] = relationship(back_populates="userdays")
    information: Mapped[str] = mapped_column(String)
    attendance: Mapped[Attendance] = mapped_column(Enum, default=Attendance.UNKNOWN)
    applicationform_id: Mapped[int] = mapped_column(ForeignKey("applicationforms.id"))
    applicationform: Mapped[ApplicationForm] = relationship(back_populates="userdays")


application_wanted_roles = Table(
    "application_wanted_roles",
    Base.metadata,
    Column("application_id", ForeignKey("applicationforms.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)


class ApplicationForm(Base, TimestampMixin):
    __tablename__ = "applicationforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    user: Mapped[User] = relationship(back_populates="applicationforms")
    experience: Mapped[float] = mapped_column(Double)
    wanted_roles: Mapped[set[Role]] = relationship(
        secondary=application_wanted_roles, back_populates="applications", collection_class=set
    )
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    year: Mapped[Year] = relationship(back_populates="users")
    userdays: Mapped[list[UserDay]] = relationship(
        back_populates="applicationform", cascade="all, delete-orphan"
    )
    additional_info: Mapped[str] = mapped_column(String)


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_name: Mapped[str] = mapped_column(String)
    applications: Mapped[set[ApplicationForm]] = relationship(
        secondary=application_wanted_roles, back_populates="wanted_roles", collection_class=set
    )
