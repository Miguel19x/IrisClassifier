"""add brand and distributor code registries

Revision ID: f8a3b2c4d5e6
Revises: df6213cf2f0a
Create Date: 2024-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a3b2c4d5e6'
down_revision: Union[str, None] = 'df6213cf2f0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create brand_registry table
    op.create_table(
        'brand_registry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('brand_name', sa.String(length=200), nullable=False),
        sa.Column('normalized_name', sa.String(length=200), nullable=False),
        sa.Column('source', sa.String(length=20), nullable=True),
        sa.Column('occurrence_count', sa.Integer(), nullable=True, default=1),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('brand_name'),
        sa.CheckConstraint("source IN ('manual', 'auto_learned')")
    )
    op.create_index('idx_brand_registry_name', 'brand_registry', ['brand_name'])
    op.create_index('idx_brand_registry_normalized', 'brand_registry', ['normalized_name'])
    op.create_index('idx_brand_registry_active', 'brand_registry', ['is_active'])
    
    # Create distributor_code_registry table
    op.create_table(
        'distributor_code_registry',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('distributor_code', sa.String(length=100), nullable=False),
        sa.Column('product_code', sa.String(length=100), nullable=False),
        sa.Column('distributor_name', sa.String(length=200), nullable=True),
        sa.Column('source_list_id', sa.Integer(), nullable=True),
        sa.Column('occurrence_count', sa.Integer(), nullable=True, default=1),
        sa.Column('first_seen', sa.DateTime(), nullable=True),
        sa.Column('last_seen', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['source_list_id'], ['lists.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('distributor_code', 'product_code', name='uq_distributor_product')
    )
    op.create_index('idx_distributor_code', 'distributor_code_registry', ['distributor_code'])
    op.create_index('idx_distributor_product_code', 'distributor_code_registry', ['product_code'])


def downgrade() -> None:
    op.drop_table('distributor_code_registry')
    op.drop_table('brand_registry')
