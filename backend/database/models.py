"""
SQLAlchemy database models for IrisClassifier.

Implements the complete database schema with proper relationships,
indexes, and constraints for optimal performance.

REFACTORED: All "Catalog" references eliminated. Using "PriceList" terminology.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    CheckConstraint,
    UniqueConstraint,
    func,
    JSON,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class User(Base):
    """
    User model for authentication and ownership.
    
    Attributes:
        id: Primary key
        email: Unique email address
        password_hash: Hashed password
        created_at: Account creation timestamp
        last_login: Last login timestamp
        is_active: Whether account is active
    """
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    price_lists: Mapped[List["PriceList"]] = relationship("PriceList", back_populates="user", cascade="all, delete-orphan")
    price_ranges: Mapped[List["PriceRange"]] = relationship("PriceRange", back_populates="user", cascade="all, delete-orphan")
    categories: Mapped[List["Category"]] = relationship("Category", back_populates="user", cascade="all, delete-orphan")


class PriceList(Base):
    """
    Price List model representing uploaded files.
    
    This is the core entity for managing uploaded price lists/catalogs.
    
    Note: Table name is 'catalogs' for database compatibility.
    All code references use 'PriceList' or 'list'.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: List name
        source_file: Original filename
        file_type: MIME type
        file_size_bytes: File size
        status: Processing status
        created_at: Upload timestamp
        processed_at: Processing completion timestamp
        product_count: Denormalized count of products
    """
    __tablename__ = "lists"  # Migrated from 'catalogs'
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_file: Mapped[Optional[str]] = mapped_column(String(500))
    file_type: Mapped[Optional[str]] = mapped_column(String(50))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed')"),
        default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), index=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    product_count: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="price_lists")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="price_list", cascade="all, delete-orphan")
    processing_logs: Mapped[List["ProcessingLog"]] = relationship("ProcessingLog", back_populates="price_list", cascade="all, delete-orphan")
    master_products: Mapped[List["MasterProduct"]] = relationship("MasterProduct", back_populates="source_list", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_lists_user_id", "user_id"),
        Index("idx_lists_status", "status"),
        Index("idx_lists_created", "created_at"),
    )


class PriceRange(Base):
    """
    Price range model for classification.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: Range name (e.g., "Barato", "Caro")
        min_price: Minimum price (inclusive)
        max_price: Maximum price (inclusive, NULL = no limit)
        color: Hex color code for UI
        display_order: Order in UI
        is_default: Whether this is a default range
        created_at: Creation timestamp
    """
    __tablename__ = "price_ranges"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    max_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    color: Mapped[str] = mapped_column(String(7), default="#808080")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="price_ranges")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="price_range")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("max_price >= min_price OR max_price IS NULL", name="chk_price_range"),
        UniqueConstraint("user_id", "name", name="uq_user_range_name"),
        Index("idx_price_ranges_user", "user_id", "display_order"),
    )


class Category(Base):
    """
    Category model for product categorization (hierarchical).
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: Category name
        description: Category description
        parent_id: Parent category (for hierarchy)
    """
    __tablename__ = "categories"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    
    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="categories")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")
    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side=[id], backref="children")
    
    # Indexes
    __table_args__ = (
        Index("idx_categories_user", "user_id"),
        Index("idx_categories_parent", "parent_id"),
    )


class Product(Base):
    """
    Product model representing extracted products from price lists.
    
    Supports both traditional price-based lists and flexible multi-column lists.
    
    Attributes:
        id: Primary key
        list_id: Foreign key to price list
        category_id: Foreign key to category
        price_range_id: Foreign key to price range
        code: Product code/SKU
        name: Product name
        brand: Product brand
        price: Product price (nullable for non-price lists)
        currency: Currency code
        original_text: Original extracted text
        list_type: Type of list ("price_list", "automotive_parts", etc.)
        structured_data: JSON field for flexible column data
        confidence_score: Classification confidence (0-1)
        classification_method: How it was classified
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "products"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    price_range_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("price_ranges.id", ondelete="SET NULL"))
    row_index: Mapped[int] = mapped_column(Integer, default=0, index=True)  # Sequential order within list
    
    # Core product fields
    code: Mapped[Optional[str]] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(200))
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    
    # Additional data
    original_text: Mapped[Optional[str]] = mapped_column(Text)
    list_type: Mapped[str] = mapped_column(String(50), default="price_list")
    structured_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    confidence_score: Mapped[float] = mapped_column(
        Numeric(3, 2),
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 1"),
        default=1.0
    )
    classification_method: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("classification_method IN ('pending', 'ai', 'fallback', 'manual')"),
        default="pending"
    )
    review_status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("review_status IN ('pending', 'confirmed', 'rejected')"),
        default="pending"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    price_list: Mapped["PriceList"] = relationship("PriceList", back_populates="products")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="products")
    price_range: Mapped[Optional["PriceRange"]] = relationship("PriceRange", back_populates="products")
    tags: Mapped[List["ProductTag"]] = relationship("ProductTag", back_populates="product", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_products_list", "list_id"),
        Index("idx_products_price_range", "price_range_id"),
        Index("idx_products_price", "price"),
        Index("idx_products_catalog_price", "list_id", "price"),
        Index("idx_products_catalog_range", "list_id", "price_range_id"),
    )


class Tag(Base):
    """
    Tag model for product tagging.
    
    Attributes:
        id: Primary key
        name: Unique tag name
    """
    __tablename__ = "tags"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    
    # Relationships
    products: Mapped[List["ProductTag"]] = relationship("ProductTag", back_populates="tag")


class ProductTag(Base):
    """
    Many-to-many relationship between products and tags.
    """
    __tablename__ = "product_tags"
    
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
    
    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="tags")
    tag: Mapped["Tag"] = relationship("Tag", back_populates="products")
    
    # Indexes
    __table_args__ = (
        Index("idx_product_tags_tag", "tag_id"),
    )


class ProcessingLog(Base):
    """
    Processing log model for audit trail and progress tracking.
    
    Attributes:
        id: Primary key
        list_id: Foreign key to price list
        status: Processing status
        error_message: Error message if failed
        products_extracted: Number of products extracted
        products_classified: Number of products classified
        processing_time_seconds: Time taken to process
        total_pages: Total pages in document (for PDFs)
        pages_processed: Pages processed so far
        current_batch: Current batch being processed
        total_batches: Total batches to process
        progress_message: Human-readable progress message
        created_at: Log timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "processing_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    list_id: Mapped[int] = mapped_column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('started', 'extracting', 'classifying', 'completed', 'failed')"),
        nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    products_extracted: Mapped[int] = mapped_column(Integer, default=0)
    products_classified: Mapped[int] = mapped_column(Integer, default=0)
    processing_time_seconds: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    
    # Progress tracking fields
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    pages_processed: Mapped[int] = mapped_column(Integer, default=0)
    current_batch: Mapped[int] = mapped_column(Integer, default=0)
    total_batches: Mapped[int] = mapped_column(Integer, default=0)
    progress_message: Mapped[Optional[str]] = mapped_column(String(255))
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    price_list: Mapped["PriceList"] = relationship("PriceList", back_populates="processing_logs")
    
    # Indexes
    __table_args__ = (
        Index("idx_processing_logs_catalog", "list_id", "created_at"),
    )


class ProductMatch(Base):
    """
    Groups products that are the same item across different price lists.
    Enables price comparison between suppliers.
    """
    __tablename__ = "product_matches"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False)
    match_method: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("match_method IN ('ai', 'fuzzy', 'manual', 'exact')"),
        default="exact"
    )
    confidence: Mapped[float] = mapped_column(
        Numeric(3, 2),
        CheckConstraint("confidence >= 0 AND confidence <= 1"),
        default=1.0
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user: Mapped["User"] = relationship("User", backref="product_matches")
    members: Mapped[List["ProductMatchMember"]] = relationship(
        "ProductMatchMember", 
        back_populates="match",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("idx_product_matches_user", "user_id"),
        Index("idx_product_matches_name", "canonical_name"),
    )


class ProductMatchMember(Base):
    """
    Individual products that belong to a product match group.
    """
    __tablename__ = "product_match_members"
    
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("product_matches.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    is_best_price: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Relationships
    match: Mapped["ProductMatch"] = relationship("ProductMatch", back_populates="members")
    product: Mapped["Product"] = relationship("Product", backref="match_memberships")
    
    # Indexes
    __table_args__ = (
        Index("idx_match_members_product", "product_id"),
        Index("idx_match_members_best_price", "is_best_price"),
    )


class MixedListing(Base):
    """
    User-created listing combining products from multiple price lists.
    """
    __tablename__ = "mixed_listings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    user: Mapped["User"] = relationship("User", backref="mixed_listings")
    products: Mapped[List["MixedListingProduct"]] = relationship(
        "MixedListingProduct",
        back_populates="listing",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("idx_mixed_listings_user", "user_id"),
        Index("idx_mixed_listings_created", "created_at"),
    )


class MixedListingProduct(Base):
    """
    Products included in a mixed listing.
    """
    __tablename__ = "mixed_listing_products"
    
    listing_id: Mapped[int] = mapped_column(Integer, ForeignKey("mixed_listings.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # Relationships
    listing: Mapped["MixedListing"] = relationship("MixedListing", back_populates="products")
    product: Mapped["Product"] = relationship("Product", backref="listing_memberships")
    
    # Indexes
    __table_args__ = (
        Index("idx_mixed_listing_products_order", "listing_id", "display_order"),
    )


class MasterProduct(Base):
    """
    Master Product model for unified product management.
    
    This is the core table for "Gestión Listados" (Listings Management).
    Consolidates products from all price lists into a single master table
    with intelligent code normalization and review workflow.
    
    Schema: N° | CODIGO O REFERENCIA | DESCRIPCION | MARCA | USD | STATUS_REVISION
    """
    __tablename__ = "master_products"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    index_number: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    clean_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(200), index=True)
    price_usd: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    
    # Review system
    review_status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("review_status IN ('pending', 'confirmed', 'rejected')"),
        default="pending",
        index=True
    )
    confidence_score: Mapped[float] = mapped_column(
        Numeric(3, 2),
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 1"),
        default=1.0
    )
    
    # Source tracking
    source_list_id: Mapped[int] = mapped_column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    original_list_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Pricing for dual views
    margin_percentage: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    final_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))
    
    # Audit trail
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    source_list: Mapped["PriceList"] = relationship("PriceList", back_populates="master_products")
    
    # Indexes
    __table_args__ = (
        Index("idx_master_products_code", "clean_code"),
        Index("idx_master_products_brand", "brand"),
        Index("idx_master_products_review", "review_status"),
        Index("idx_master_products_source", "source_list_id"),
        Index("idx_master_products_index", "index_number"),
    )


class CodeRegistry(Base):
    """
    Universal code registry for historical validation.
    
    Used by ETL Intelligent Service (Layer 2) for code normalization.
    """
    __tablename__ = "code_registry"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    clean_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    canonical_description: Mapped[Optional[str]] = mapped_column(String(500))
    canonical_brand: Mapped[Optional[str]] = mapped_column(String(200))
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    alternate_codes: Mapped[Optional[dict]] = mapped_column(JSON)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index("idx_code_registry_code", "clean_code"),
        Index("idx_code_registry_brand", "canonical_brand"),
    )


class BrandRegistry(Base):
    """
    Brand registry for automatic brand learning and manual brand list.
    
    Used for:
    1. Detecting brands embedded in code cells
    2. Auto-learning new brands from processed files
    3. Maintaining a curated list of known brands
    """
    __tablename__ = "brand_registry"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand_name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    normalized_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)  # Uppercase, no spaces
    source: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("source IN ('manual', 'auto_learned')"),
        default="auto_learned"
    )
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index("idx_brand_registry_name", "brand_name"),
        Index("idx_brand_registry_normalized", "normalized_name"),
        Index("idx_brand_registry_active", "is_active"),
    )


class DistributorCodeRegistry(Base):
    """
    Registry for distributor-specific internal codes.
    
    Maps distributor codes (e.g., ALT01037) to product codes (e.g., B11-3701110BB).
    Used for future correlation and distributor identification.
    """
    __tablename__ = "distributor_code_registry"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    distributor_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    distributor_name: Mapped[Optional[str]] = mapped_column(String(200))  # Inferred from list name
    source_list_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("lists.id", ondelete="SET NULL"))
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        Index("idx_distributor_code", "distributor_code"),
        Index("idx_distributor_product_code", "product_code"),
        UniqueConstraint("distributor_code", "product_code", name="uq_distributor_product"),
    )

