"""merge identities and skills

Revision ID: a575f35e0633
Revises: 65685f86179a, 0c9ac87df950
Create Date: 2026-10-04 18:16:21.068512

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "a575f35e0633"
down_revision: str | Sequence[str] | None = ("65685f86179a", "0c9ac87df950")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
