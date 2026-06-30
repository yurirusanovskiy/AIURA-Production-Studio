"""add_project_fields_and_dict_constraints

Revision ID: 227ba3c22a92
Revises: 4e05a0f7a7eb
Create Date: 2026-06-14 00:36:53.684907

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '227ba3c22a92'
down_revision: Union[str, Sequence[str], None] = '4e05a0f7a7eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Run in batch mode for SQLite compatibility
    with op.batch_alter_table('dictionaryentry', schema=None) as batch_op:
        batch_op.drop_index('ix_dictionaryentry_word')
        batch_op.create_index('ix_dictionaryentry_word', ['word'], unique=False)
        batch_op.create_unique_constraint('uq_dictionary_entry_language_word', ['language', 'word'])

    op.add_column('project', sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('project', sa.Column('updated_at', sa.DateTime(), nullable=True))

    with op.batch_alter_table('sceneline', schema=None) as batch_op:
        batch_op.alter_column('is_manual_phonetics',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('0'))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('sceneline', schema=None) as batch_op:
        batch_op.alter_column('is_manual_phonetics',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('0'))

    op.drop_column('project', 'updated_at')
    op.drop_column('project', 'description')

    with op.batch_alter_table('dictionaryentry', schema=None) as batch_op:
        batch_op.drop_constraint('uq_dictionary_entry_language_word', type_='unique')
        batch_op.drop_index('ix_dictionaryentry_word')
        batch_op.create_index('ix_dictionaryentry_word', ['word'], unique=True)
