"""
SQLAlchemy database models for IrisClassifier.

Implements the complete database schema with proper relationships,
indexes, and constraints for optimal performance.
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
from sqlalchemy.dialects.postgresql import TSVECTOR


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
    catalogs: Mapped[List["Catalog"]] = relationship("Catalog", back_populates="user", cascade="all, delete-orphan")
    price_ranges: Mapped[List["PriceRange"]] = relationship("PriceRange", back_populates="user", cascade="all, delete-orphan")
    categories: Mapped[List["Category"]] = relationship("Category", back_populates="user", cascade="all, delete-orphan")


class Catalog(Base):
    """
    Catalog model representing uploaded files.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: Catalog name
        source_file: Original filename
        file_type: MIME type
        file_size_bytes: File size
        status: Processing status
        created_at: Upload timestamp
        processed_at: Processing completion timestamp
        product_count: Denormalized count of products
    """
    __tablename__ = "catalogs"
    
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
    user: Mapped["User"] = relationship("User", back_populates="catalogs")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="catalog", cascade="all, delete-orphan")
    processing_logs: Mapped[List["ProcessingLog"]] = relationship("ProcessingLog", back_populates="catalog", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index("idx_catalogs_user_id", "user_id"),
        Index("idx_catalogs_status", "status"),
        Index("idx_catalogs_created", "created_at"),
    )


class PriceRange(Base):
    """
    Price range model for classification.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: Range name (e.g., "Cheap", "Expensive")
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
    Product model representing extracted products.
    
    Supports both traditional price-based catalogs and flexible multi-column catalogs.
    
    Attributes:
        id: Primary key
        catalog_id: Foreign key to catalog
        category_id: Foreign key to category
        price_range_id: Foreign key to price range
        name: Product name (or primary identifier)
        price: Product price (nullable for non-price catalogs)
        currency: Currency code
        original_text: Original extracted text
        catalog_type: Type of catalog ("price_list", "automotive_parts", etc.)
        structured_data: JSON field for flexible column data
        confidence_score: Classification confidence (0-1)
        classification_method: How it was classified
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    __tablename__ = "products"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    catalog_id: Mapped[int] = mapped_column(Integer, ForeignKey("catalogs.id", ondelete="CASCADE"), nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    price_range_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("price_ranges.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2))  # Nullable for non-price catalogs
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    original_text: Mapped[Optional[str]] = mapped_column(Text)
    catalog_type: Mapped[str] = mapped_column(String(50), default="price_list")  # NEW: catalog type
    structured_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # NEW: flexible columns
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    catalog: Mapped["Catalog"] = relationship("Catalog", back_populates="products")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="products")
    price_range: Mapped[Optional["PriceRange"]] = relationship("PriceRange", back_populates="products")
    tags: Mapped[List["ProductTag"]] = relationship("ProductTag", back_populates="product", cascade="all, delete-orphan")
    
    # Indexes for performance
    __table_args__ = (
        Index("idx_products_catalog", "catalog_id"),
        Index("idx_products_price_range", "price_range_id"),
        Index("idx_products_price", "price"),
        Index("idx_products_catalog_price", "catalog_id", "price"),
        Index("idx_products_catalog_range", "catalog_id", "price_range_id"),
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
    
    Attributes:
        product_id: Foreign key to product
        tag_id: Foreign key to tag
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
        catalog_id: Foreign key to catalog
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
    catalog_id: Mapped[int] = mapped_column(Integer, ForeignKey("catalogs.id", ondelete="CASCADE"), nullable=False)
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
    catalog: Mapped["Catalog"] = relationship("Catalog", back_populates="processing_logs")
    
    # Indexes
    __table_args__ = (
        Index("idx_processing_logs_catalog", "catalog_id", "created_at"),
    )


class ProductMatch(Base):
    """
    Groups products that are the same item across different catalogs.
    Enables price comparison between suppliers.
    
    Attributes:
        id: Primary key
        user_id: User who created/owns this match
        canonical_name: Normalized product name
        match_method: How products were matched ('ai', 'fuzzy', 'manual', 'exact')
        confidence: Match confidence score (0-1)
        created_at: Creation timestamp
        updated_at: Last update timestamp
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
    
    Attributes:
        match_id: Foreign key to product match
        product_id: Foreign key to product
        is_best_price: Whether this product has the best price in the group
        added_at: When this product was added to the match
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
    User-created listing combining products from multiple catalogs.
    
    Attributes:
        id: Primary key
        user_id: Foreign key to user
        name: Listing name
        description: Optional description
        created_at: Creation timestamp
        updated_at: Last update timestamp
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
    
    Attributes:
        listing_id: Foreign key to mixed listing
        product_id: Foreign key to product
        display_order: Order in which to display this product
        added_at: When this product was added
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

