"""Add pitch_override to Character

Revision ID: 1d70e0c3b7ff
Revises: d544d5cd3378
Create Date: 2026-06-10 18:08:33.550512

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '1d70e0c3b7ff'
down_revision: Union[str, Sequence[str], None] = 'd544d5cd3378'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('character', sa.Column('pitch_override', sqlmodel.sql.sqltypes.AutoString(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('character', 'pitch_override')
