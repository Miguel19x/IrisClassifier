"""add_progress_columns_to_processing_logs

Revision ID: df6213cf2f0a
Revises: e212c9d6f695
Create Date: 2025-12-28 00:38:50.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'df6213cf2f0a'
down_revision: Union[str, Sequence[str], None] = 'e212c9d6f695'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add progress tracking columns to processing_logs table
    op.add_column('processing_logs', sa.Column('total_pages', sa.Integer(), nullable=True))
    op.add_column('processing_logs', sa.Column('pages_processed', sa.Integer(), nullable=True))
    op.add_column('processing_logs', sa.Column('current_batch', sa.Integer(), nullable=True))
    op.add_column('processing_logs', sa.Column('total_batches', sa.Integer(), nullable=True))
    op.add_column('processing_logs', sa.Column('progress_message', sa.String(255), nullable=True))
    op.add_column('processing_logs', sa.Column('updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('processing_logs', 'updated_at')
    op.drop_column('processing_logs', 'progress_message')
    op.drop_column('processing_logs', 'total_batches')
    op.drop_column('processing_logs', 'current_batch')
    op.drop_column('processing_logs', 'pages_processed')
    op.drop_column('processing_logs', 'total_pages')
