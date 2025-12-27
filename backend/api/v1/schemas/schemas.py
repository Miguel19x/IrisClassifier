"""
Pydantic schemas for API request/response validation.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# Catalog schemas
class CatalogBase(BaseModel):
    """Base catalog schema."""
    name: str = Field(..., min_length=1, max_length=255)


class CatalogCreate(CatalogBase):
    """Schema for creating a catalog."""
    pass


class CatalogResponse(CatalogBase):
    """Schema for catalog response."""
    id: int
    user_id: int
    source_file: Optional[str] = None
    file_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None
    product_count: int
    
    model_config = ConfigDict(from_attributes=True)


class CatalogList(BaseModel):
    """Schema for catalog list response."""
    catalogs: List[CatalogResponse]
    total: int
    page: int
    page_size: int


# Product schemas
class ProductBase(BaseModel):
    """Base product schema."""
    name: str = Field(..., min_length=1, max_length=500)
    price: Optional[Decimal] = Field(None, ge=0)
    currency: str = Field(default="USD", max_length=10)


class ProductCreate(ProductBase):
    """Schema for creating a product."""
    catalog_id: int
    category_id: Optional[int] = None


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    price: Optional[Decimal] = Field(None, ge=0)
    price_range_id: Optional[int] = None
    category_id: Optional[int] = None


class ProductResponse(ProductBase):
    """Schema for product response."""
    id: int
    catalog_id: int
    category_id: Optional[int] = None
    price_range_id: Optional[int] = None
    price_range_name: Optional[str] = None
    confidence_score: float
    classification_method: str
    catalog_type: str = "price_list"  # NEW: catalog type
    structured_data: Optional[Dict[str, Any]] = None  # NEW: flexible column data
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ProductList(BaseModel):
    """Schema for product list response."""
    products: List[ProductResponse]
    total: int
    page: int
    page_size: int


# Price Range schemas
class PriceRangeBase(BaseModel):
    """Base price range schema."""
    name: str = Field(..., min_length=1, max_length=100)
    min_price: Optional[Decimal] = Field(None, ge=0)
    max_price: Optional[Decimal] = Field(None, ge=0)
    color: str = Field(default="#808080", pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: int = Field(default=0, ge=0)


class PriceRangeCreate(PriceRangeBase):
    """Schema for creating a price range."""
    pass


class PriceRangeUpdate(BaseModel):
    """Schema for updating a price range."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    min_price: Optional[Decimal] = Field(None, ge=0)
    max_price: Optional[Decimal] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    display_order: Optional[int] = Field(None, ge=0)


class PriceRangeResponse(PriceRangeBase):
    """Schema for price range response."""
    id: int
    user_id: int
    is_default: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Upload schemas
class UploadResponse(BaseModel):
    """Schema for upload response."""
    catalog_id: int
    message: str
    status: str


# Error schemas
class ErrorResponse(BaseModel):
    """Schema for error responses."""
    error: dict = Field(..., example={"code": "ERROR_CODE", "message": "Error message"})
