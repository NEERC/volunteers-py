from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from volunteers.models.application_form import ApplicationForm
from volunteers.models.base import Base, TimestampMixin
from volunteers.models.common import application_wanted_roles


class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_name: Mapped[str] = mapped_column(String)
    applications: Mapped[set[ApplicationForm]] = relationship(
        secondary=application_wanted_roles,
        back_populates="wanted_roles",
        collection_class=set
        )
