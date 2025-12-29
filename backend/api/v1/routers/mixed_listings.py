"""
Mixed Listings API Router.

Endpoints for creating and managing mixed product listings.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from pydantic import BaseModel
from datetime import datetime

from database.connection import get_db
from database.models import (
    MixedListing, MixedListingProduct, Product, 
    ProductMatch, ProductMatchMember, PriceRange
)
from api.dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mixed-listings", tags=["mixed-listings"])


# Schemas
class CreateMixedListingRequest(BaseModel):
    """Request to create a mixed listing."""
    name: str
    description: Optional[str] = None
    list_ids: List[int]
    use_best_prices: bool = True  # Auto-select best prices from matches
    price_range_ids: Optional[List[int]] = None  # Filter by price ranges


class MixedListingResponse(BaseModel):
    """Mixed listing response."""
    id: int
    name: str
    description: Optional[str]
    product_count: int
    created_at: datetime
    updated_at: datetime


class ProductInListing(BaseModel):
    """Product in a mixed listing."""
    product_id: int
    name: str
    price: Optional[float]
    list_id: int
    catalog_name: str
    price_range_name: Optional[str]
    is_best_price: bool


class MixedListingProductsResponse(BaseModel):
    """Products in a mixed listing."""
    listing: MixedListingResponse
    products: List[ProductInListing]
    total: int


@router.post("", response_model=MixedListingResponse)
async def create_mixed_listing(
    request: CreateMixedListingRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a mixed listing combining products from multiple catalogs.
    
    Args:
        request: Mixed listing creation request
        user_id: Current user ID
        db: Database session
        
    Returns:
        Created mixed listing
    """
    # Create listing
    listing = MixedListing(
        user_id=user_id,
        name=request.name,
        description=request.description
    )
    db.add(listing)
    db.flush()
    
    # Get products from specified catalogs
    query = db.query(Product).filter(
        Product.list_id.in_(request.list_ids)
    )
    
    # Filter by price ranges if specified
    if request.price_range_ids:
        query = query.filter(Product.price_range_id.in_(request.price_range_ids))
    
    products = query.all()
    
    # If use_best_prices, only include best price from each match
    if request.use_best_prices:
        # Get all matches for this user
        matches = db.query(ProductMatch).filter(
            ProductMatch.user_id == user_id
        ).all()
        
        # Build set of best price product IDs
        best_price_ids = set()
        matched_product_ids = set()
        
        for match in matches:
            for member in match.members:
                matched_product_ids.add(member.product_id)
                if member.is_best_price:
                    best_price_ids.add(member.product_id)
        
        # Filter products: include best prices + unmatched products
        filtered_products = [
            p for p in products
            if p.id in best_price_ids or p.id not in matched_product_ids
        ]
        products = filtered_products
    
    # Add products to listing
    for i, product in enumerate(products):
        listing_product = MixedListingProduct(
            listing_id=listing.id,
            product_id=product.id,
            display_order=i
        )
        db.add(listing_product)
    
    db.commit()
    db.refresh(listing)
    
    return MixedListingResponse(
        id=listing.id,
        name=listing.name,
        description=listing.description,
        product_count=len(products),
        created_at=listing.created_at,
        updated_at=listing.updated_at
    )


@router.get("", response_model=List[MixedListingResponse])
async def list_mixed_listings(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    List all mixed listings for current user.
    
    Args:
        user_id: Current user ID
        db: Database session
        
    Returns:
        List of mixed listings
    """
    listings = db.query(MixedListing).filter(
        MixedListing.user_id == user_id
    ).order_by(MixedListing.created_at.desc()).all()
    
    return [
        MixedListingResponse(
            id=listing.id,
            name=listing.name,
            description=listing.description,
            product_count=len(listing.products),
            created_at=listing.created_at,
            updated_at=listing.updated_at
        )
        for listing in listings
    ]


@router.get("/{listing_id}/products", response_model=MixedListingProductsResponse)
async def get_mixed_listing_products(
    listing_id: int,
    price_range_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("price", pattern="^(price|name|catalog)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get products in a mixed listing with filters.
    
    Args:
        listing_id: Mixed listing ID
        price_range_id: Filter by price range
        search: Search in product names
        sort_by: Sort field (price, name, catalog)
        user_id: Current user ID
        db: Database session
        
    Returns:
        Products in the listing
    """
    # Get listing
    listing = db.query(MixedListing).filter(
        MixedListing.id == listing_id,
        MixedListing.user_id == user_id
    ).first()
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Get products
    query = db.query(Product, MixedListingProduct).join(
        MixedListingProduct,
        Product.id == MixedListingProduct.product_id
    ).filter(
        MixedListingProduct.listing_id == listing_id
    )
    
    # Apply filters
    if price_range_id:
        query = query.filter(Product.price_range_id == price_range_id)
    
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    
    # Apply sorting
    if sort_by == "price":
        query = query.order_by(Product.price.asc())
    elif sort_by == "name":
        query = query.order_by(Product.name.asc())
    elif sort_by == "catalog":
        query = query.order_by(Product.list_id.asc())
    
    results = query.all()
    
    # Check which products have best prices
    best_price_ids = set()
    matches = db.query(ProductMatchMember).filter(
        ProductMatchMember.is_best_price == True
    ).all()
    for match in matches:
        best_price_ids.add(match.product_id)
    
    # Build response
    products_data = []
    for product, _ in results:
        products_data.append(ProductInListing(
            product_id=product.id,
            name=product.name,
            price=float(product.price) if product.price else None,
            list_id=product.list_id,
            catalog_name=product.PriceList.name,
            price_range_name=product.price_range.name if product.price_range else None,
            is_best_price=product.id in best_price_ids
        ))
    
    return MixedListingProductsResponse(
        listing=MixedListingResponse(
            id=listing.id,
            name=listing.name,
            description=listing.description,
            product_count=len(products_data),
            created_at=listing.created_at,
            updated_at=listing.updated_at
        ),
        products=products_data,
        total=len(products_data)
    )


@router.delete("/{listing_id}")
async def delete_mixed_listing(
    listing_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete a mixed listing.
    
    Args:
        listing_id: Listing ID to delete
        user_id: Current user ID
        db: Database session
        
    Returns:
        Success message
    """
    listing = db.query(MixedListing).filter(
        MixedListing.id == listing_id,
        MixedListing.user_id == user_id
    ).first()
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    db.delete(listing)
    db.commit()
    
    return {"message": "Listing deleted successfully"}
