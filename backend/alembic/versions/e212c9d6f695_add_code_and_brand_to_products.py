"""add_code_and_brand_to_products

Revision ID: e212c9d6f695
Revises: 5cdeadb27e7f
Create Date: 2025-12-28 00:35:34.416464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e212c9d6f695'
down_revision: Union[str, Sequence[str], None] = '5cdeadb27e7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add code, brand, catalog_type, and structured_data columns to products table
    op.add_column('products', sa.Column('code', sa.String(255), nullable=True))
    op.add_column('products', sa.Column('brand', sa.String(255), nullable=True))
    op.add_column('products', sa.Column('catalog_type', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('structured_data', sa.Text(), nullable=True))
    
    # Add indexes for better query performance
    op.create_index('ix_products_code', 'products', ['code'])
    op.create_index('ix_products_brand', 'products', ['brand'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove indexes
    op.drop_index('ix_products_brand', 'products')
    op.drop_index('ix_products_code', 'products')
    
    # Remove columns
    op.drop_column('products', 'structured_data')
    op.drop_column('products', 'catalog_type')
    op.drop_column('products', 'brand')
    op.drop_column('products', 'code')
