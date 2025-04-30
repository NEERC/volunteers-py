from datetime import datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

metadata = MetaData()


class Base(AsyncAttrs, DeclarativeBase):
    metadata = metadata


class TimestampMixin:
    """Adds created_at / updated_at columns that stamp themselves."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  # let the database fill it in
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),  # fill on INSERT
        onupdate=func.now(),  # fill on UPDATE
        nullable=False,
    )
