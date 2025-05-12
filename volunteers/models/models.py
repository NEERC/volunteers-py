from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

# from .attendance import Attendance
from .base import Base, TimestampMixin


class Year(Base, TimestampMixin):
    __tablename__ = "years"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_name: Mapped[str] = mapped_column(String)
    open_for_registration: Mapped[bool] = mapped_column(Boolean)

    application_forms: Mapped[set[ApplicationForm]] = relationship(
        back_populates="year", cascade="all, delete-orphan"
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    telegram_id: Mapped[int] = mapped_column(Integer, unique=True)
    first_name: Mapped[str] = mapped_column(String)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    last_name: Mapped[str | None] = mapped_column(String, nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String, nullable=True)
    isu_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

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

    # experience: Mapped[float] = mapped_column(Double)
    # additional_info: Mapped[str] = mapped_column(String)

    itmo_group: Mapped[str | None] = mapped_column(String, default="", nullable=True)
    comments: Mapped[str] = mapped_column(String, default="")

    desired_positions: Mapped[set[Position]] = relationship(
        secondary="application_form_position_association",
        collection_class=set,
    )

    # userdays: Mapped[list[UserDay]] = relationship(
    #     back_populates="applicationform", cascade="all, delete-orphan"
    # )

    __table_args__ = (
        # UniqueConstraint("id", "year_id", name="application_forms_unique_id_year_id"),
        UniqueConstraint("year_id", "user_id", name="application_forms_unique_year_id_user_id"),
    )


class Position(Base, TimestampMixin):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
    name: Mapped[str] = mapped_column(String, unique=True)

    # __table_args__ = (
    #     UniqueConstraint("id", "year_id", name="positions_unique_id_year_id"),
    # )


class FormPositionAssociation(Base, TimestampMixin):
    __tablename__ = "application_form_position_association"
    form_id: Mapped[int] = mapped_column(ForeignKey("application_forms.id"), primary_key=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("positions.id"), primary_key=True)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))

    # TODO:
    # __table_args__ = (
    #     ForeignKeyConstraint(["form_id", "year_id"], ["application_forms.id", "application_forms.year_id"]),
    #     ForeignKeyConstraint(["position_id", "year_id"], ["positions.id", "positions.year_id"]),
    # )


# class Day(Base, TimestampMixin):
#     __tablename__ = "days"
#     id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     day_name: Mapped[str] = mapped_column(String)
#     information: Mapped[str] = mapped_column(String)
#     year_id: Mapped[int] = mapped_column(ForeignKey("years.id"))
#     year: Mapped[Year] = relationship(back_populates="days")
#     userdays: Mapped[set[UserDay]] = relationship(
#         back_populates="day", cascade="all, delete-orphan"
#     )


# class Assessment(Base, TimestampMixin):
#     __tablename__ = "assessments"
#     id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     comment: Mapped[str] = mapped_column(String)
#     value: Mapped[float] = mapped_column(Double)
#     user_id: Mapped[int] = mapped_column(ForeignKey("userdays.id"))
#     user: Mapped[UserDay] = relationship(back_populates="assessments")


# class UserDay(Base, TimestampMixin):
#     __tablename__ = "userdays"
#     id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     day_id: Mapped[int] = mapped_column(ForeignKey("days.id"))
#     day: Mapped[Day] = relationship(back_populates="userdays")
#     information: Mapped[str] = mapped_column(String)
#     attendance: Mapped[Attendance] = mapped_column(Enum, default=Attendance.UNKNOWN)
#     applicationform_id: Mapped[int] = mapped_column(ForeignKey("applicationforms.id"))
#     applicationform: Mapped[ApplicationForm] = relationship(back_populates="userdays")
#     assessments: Mapped[set[Assessment]] = relationship(
#         back_populates="user", cascade="all, delete-orphan"
#     )


# application_wanted_roles = Table(
#     "application_wanted_roles",
#     Base.metadata,
#     Column("application_id", ForeignKey("applicationforms.id"), primary_key=True),
#     Column("role_id", ForeignKey("roles.id"), primary_key=True),
# )


# class Role(Base, TimestampMixin):
#     __tablename__ = "roles"
#     id: Mapped[int] = mapped_column(Integer, primary_key=True)
#     role_name: Mapped[str] = mapped_column(String)
#     applications: Mapped[set[ApplicationForm]] = relationship(
#         secondary=application_wanted_roles, back_populates="wanted_roles", collection_class=set
#     )
