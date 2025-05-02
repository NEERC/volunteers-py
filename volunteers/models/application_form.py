from sqlalchemy import Double, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.base import Base, TimestampMixin
from volunteers.models.common import application_wanted_roles
from volunteers.models.role import Role
from volunteers.models.user import User
from volunteers.models.userday import UserDay
from volunteers.models.year import Year


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
