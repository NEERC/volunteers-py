from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.base import Base, TimestampMixin
from volunteers.models.user import User
from volunteers.models.userday import UserDay
from volunteers.models.year import Year


class ApplicationForm(Base, TimestampMixin):
    __tablename__ = "applicationforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user: Mapped["User"] = relationship(back_populates="applicationforms")
    year: Mapped["Year"] = relationship(back_populates="users")
    userdays: Mapped["UserDay"] = relationship(back_populates="applicationforms")

    def ApplicationForm(self, user: User, year: Year):
        self.user = user
        self.year = year
