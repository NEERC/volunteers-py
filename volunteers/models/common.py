from sqlalchemy import Column, ForeignKey, Table

from volunteers.models.base import Base

application_wanted_roles = Table(
    "application_wanted_roles",
    Base.metadata,
    Column("application_id", ForeignKey("applicationforms.id"), primaryKey = True),
    Column("role_id", ForeignKey("roles.id"), primaryKey = True)
)
