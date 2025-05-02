from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.application_form import ApplicationForm
from volunteers.models.attendance import Attendance
from volunteers.models.base import Base, TimestampMixin
from volunteers.models.day import Day


class UserDay(Base, TimestampMixin):
    __tablename__ = "userdays"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day: Mapped[Day] = relationship(back_populates="userdays")
    information: Mapped[str] = mapped_column(String)
    attendance: Mapped[Attendance] = mapped_column(Enum, default=Attendance.UNKNOWN)
    applicationform: Mapped[ApplicationForm] = relationship(back_populates="userdays")
