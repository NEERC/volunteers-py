from sqlalchemy import ForeignKey, LargeBinary, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class PrintTemplate(Base):
    __tablename__ = "print_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    year_id: Mapped[int] = mapped_column(ForeignKey("years.id", ondelete="CASCADE"), index=True)
    title: Mapped[str]
    source: Mapped[str] = mapped_column(Text)


class PrintTemplateAsset(Base):
    __tablename__ = "print_template_assets"
    __table_args__ = (UniqueConstraint("template_id", "file_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("print_templates.id", ondelete="CASCADE"))
    file_name: Mapped[str]
    content_type: Mapped[str]
    size: Mapped[int]
    data: Mapped[bytes] = mapped_column(LargeBinary, deferred=True, deferred_raiseload=True)
