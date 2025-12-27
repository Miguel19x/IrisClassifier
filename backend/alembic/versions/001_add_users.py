"""Add users table and update relationships

Revision ID: 001_add_users
Revises: 
Create Date: 2025-12-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_add_users'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_login', sa.DateTime(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create catalogs table
    op.create_table('catalogs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('source_file', sa.String(length=500), nullable=True),
    sa.Column('file_type', sa.String(length=50), nullable=True),
    sa.Column('file_size_bytes', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('processed_at', sa.DateTime(), nullable=True),
    sa.Column('product_count', sa.Integer(), nullable=False),
    sa.CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')"),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_catalogs_created', 'catalogs', ['created_at'], unique=False)
    op.create_index('idx_catalogs_status', 'catalogs', ['status'], unique=False)
    op.create_index('idx_catalogs_user_id', 'catalogs', ['user_id'], unique=False)

    # Create price_ranges table
    op.create_table('price_ranges',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('min_price', sa.Numeric(precision=15, scale=2), nullable=True),
    sa.Column('max_price', sa.Numeric(precision=15, scale=2), nullable=True),
    sa.Column('color', sa.String(length=7), nullable=False),
    sa.Column('display_order', sa.Integer(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('max_price >= min_price OR max_price IS NULL', name='chk_price_range'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='uq_user_range_name')
    )
    op.create_index('idx_price_ranges_user', 'price_ranges', ['user_id', 'display_order'], unique=False)

    # Create categories table
    op.create_table('categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('parent_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['parent_id'], ['categories.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_categories_parent', 'categories', ['parent_id'], unique=False)
    op.create_index('idx_categories_user', 'categories', ['user_id'], unique=False)

    # Create tags table
    op.create_table('tags',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )

    # Create products table
    op.create_table('products',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('catalog_id', sa.Integer(), nullable=False),
    sa.Column('category_id', sa.Integer(), nullable=True),
    sa.Column('price_range_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=500), nullable=False),
    sa.Column('price', sa.Numeric(precision=15, scale=2), nullable=True),
    sa.Column('currency', sa.String(length=10), nullable=False),
    sa.Column('original_text', sa.Text(), nullable=True),
    sa.Column('confidence_score', sa.Numeric(precision=3, scale=2), nullable=False),
    sa.Column('classification_method', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('confidence_score >= 0 AND confidence_score <= 1'),
    sa.CheckConstraint("classification_method IN ('pending', 'ai', 'fallback', 'manual')"),
    sa.ForeignKeyConstraint(['catalog_id'], ['catalogs.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['price_range_id'], ['price_ranges.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_products_catalog', 'products', ['catalog_id'], unique=False)
    op.create_index('idx_products_catalog_price', 'products', ['catalog_id', 'price'], unique=False)
    op.create_index('idx_products_catalog_range', 'products', ['catalog_id', 'price_range_id'], unique=False)
    op.create_index('idx_products_price', 'products', ['price'], unique=False)
    op.create_index('idx_products_price_range', 'products', ['price_range_id'], unique=False)

    # Create processing_logs table
    op.create_table('processing_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('catalog_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.Column('products_extracted', sa.Integer(), nullable=False),
    sa.Column('products_classified', sa.Integer(), nullable=False),
    sa.Column('processing_time_seconds', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint("status IN ('started', 'extracting', 'classifying', 'completed', 'failed')"),
    sa.ForeignKeyConstraint(['catalog_id'], ['catalogs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_processing_logs_catalog', 'processing_logs', ['catalog_id', 'created_at'], unique=False)

    # Create product_tags table
    op.create_table('product_tags',
    sa.Column('product_id', sa.Integer(), nullable=False),
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('product_id', 'tag_id')
    )
    op.create_index('idx_product_tags_tag', 'product_tags', ['tag_id'], unique=False)


def downgrade() -> None:
    op.drop_index('idx_product_tags_tag', table_name='product_tags')
    op.drop_table('product_tags')
    op.drop_index('idx_processing_logs_catalog', table_name='processing_logs')
    op.drop_table('processing_logs')
    op.drop_index('idx_products_price_range', table_name='products')
    op.drop_index('idx_products_price', table_name='products')
    op.drop_index('idx_products_catalog_range', table_name='products')
    op.drop_index('idx_products_catalog_price', table_name='products')
    op.drop_index('idx_products_catalog', table_name='products')
    op.drop_table('products')
    op.drop_table('tags')
    op.drop_index('idx_categories_user', table_name='categories')
    op.drop_index('idx_categories_parent', table_name='categories')
    op.drop_table('categories')
    op.drop_index('idx_price_ranges_user', table_name='price_ranges')
    op.drop_table('price_ranges')
    op.drop_index('idx_catalogs_user_id', table_name='catalogs')
    op.drop_index('idx_catalogs_status', table_name='catalogs')
    op.drop_index('idx_catalogs_created', table_name='catalogs')
    op.drop_table('catalogs')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
