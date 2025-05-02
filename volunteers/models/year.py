from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.application_form import ApplicationForm
from volunteers.models.base import Base, TimestampMixin
from volunteers.models.day import Day


class Year(Base, TimestampMixin):
    __tablename__ = "years"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year_name: Mapped[str] = mapped_column(String)
    openForRegistration: Mapped[bool] = mapped_column(Boolean)
    days: Mapped[list[Day]] = relationship(back_populates="year")
    users: Mapped[set[ApplicationForm]] = relationship(back_populates="year")
