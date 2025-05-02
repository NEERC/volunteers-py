from sqlalchemy import Double, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.base import Base, TimestampMixin
from volunteers.models.role import Role
from volunteers.models.user import User
from volunteers.models.userday import UserDay
from volunteers.models.year import Year


class ApplicationForm(Base, TimestampMixin):
    __tablename__ = "applicationforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user: Mapped[User] = relationship(back_populates="applicationforms")
    experience: Mapped[float] = mapped_column(Double)
    wanted_roles: Mapped[set[Role]] = relationship(back_populates="applications")
    year: Mapped[Year] = relationship(back_populates="users")
    userdays: Mapped[list[UserDay]] = relationship(back_populates="applicationform")
    additional_info: Mapped[str] = mapped_column(String)
