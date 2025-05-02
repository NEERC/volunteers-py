from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.base import Base, TimestampMixin
from volunteers.models.userday import UserDay
from volunteers.models.year import Year


class Day(Base, TimestampMixin):
    __tablename__ = "days"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    day_name: Mapped[str] = mapped_column(String)
    information: Mapped[str] = mapped_column(String)
    year: Mapped[Year] = relationship(back_populates="days")
    userdays: Mapped[set[UserDay]] = relationship(back_populates="day")

    def addUserDay(self, userDay: UserDay):
        if userDay is not None:
            if self.userdays is None:
                self.userdays = set()
            self.userdays.add(userDay)
            userDay.day = self
