"""
Pydantic schemas for API request/response validation.

REFACTORED: "Catalog" → "List" terminology throughout.
"""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ============================================
# PRICE LIST SCHEMAS
# ============================================

class ListBase(BaseModel):
    """Base price list schema."""
    name: str = Field(..., min_length=1, max_length=255)


class ListCreate(ListBase):
    """Schema for creating a price list."""
    pass


class ListResponse(ListBase):
    """Schema for price list response."""
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


class ListCollection(BaseModel):
    """Schema for price list collection response."""
    lists: List[ListResponse]
    total: int
    page: int
    page_size: int


# ============================================
# PRODUCT SCHEMAS
# ============================================

class ProductBase(BaseModel):
    """Base product schema."""
    code: Optional[str] = Field(None, max_length=100)
    name: str = Field(..., min_length=1, max_length=500)
    brand: Optional[str] = Field(None, max_length=200)
    price: Optional[Decimal] = Field(None, ge=0)
    currency: str = Field(default="USD", max_length=10)


class ProductCreate(ProductBase):
    """Schema for creating a product."""
    list_id: int
    category_id: Optional[int] = None


class ProductUpdate(BaseModel):
    """Schema for updating a product."""
    code: Optional[str] = Field(None, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=500)
    brand: Optional[str] = Field(None, max_length=200)
    price: Optional[Decimal] = Field(None, ge=0)
    price_range_id: Optional[int] = None
    category_id: Optional[int] = None
    review_status: Optional[str] = Field(None, pattern=r'^(pending|confirmed|rejected)$')


class ProductResponse(ProductBase):
    """Schema for product response."""
    id: int
    list_id: int
    category_id: Optional[int] = None
    price_range_id: Optional[int] = None
    price_range_name: Optional[str] = None
    confidence_score: float
    classification_method: str
    review_status: str = "pending"
    list_type: str = "price_list"
    structured_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ProductList(BaseModel):
    """Schema for product list response."""
    products: List[ProductResponse]
    total: int
    page: int
    page_size: int


# ============================================
# PRICE RANGE SCHEMAS
# ============================================

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


# ============================================
# UPLOAD SCHEMAS
# ============================================

class UploadResponse(BaseModel):
    """Schema for upload response."""
    list_id: int
    message: str
    status: str


# ============================================
# MASTER PRODUCT SCHEMAS
# ============================================

class MasterProductResponse(BaseModel):
    """Schema for master product response."""
    id: int
    index_number: int
    clean_code: str
    description: str
    brand: Optional[str]
    price_usd: Decimal
    review_status: str
    confidence_score: float
    source_list_id: int
    original_list_name: str
    margin_percentage: Optional[Decimal]
    final_price: Optional[Decimal]
    
    model_config = ConfigDict(from_attributes=True)


class MasterProductCollection(BaseModel):
    """Schema for master product collection response."""
    products: List[MasterProductResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


# ============================================
# ERROR SCHEMAS
# ============================================

class ErrorResponse(BaseModel):
    """Schema for error responses."""
    error: dict = Field(..., example={"code": "ERROR_CODE", "message": "Error message"})
