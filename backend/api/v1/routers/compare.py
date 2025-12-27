"""
Comparison API Router.

Endpoints for comparing products across multiple catalogs.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from database.models import Product, ProductMatch, ProductMatchMember, Catalog
from api.dependencies import get_current_user_id
from services.product_matching_service import ProductMatchingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/compare", tags=["comparison"])


# Schemas
class CompareRequest(BaseModel):
    """Request to compare catalogs."""
    catalog_ids: List[int]
    use_ai: bool = True


class ProductComparisonItem(BaseModel):
    """Single product in comparison."""
    product_id: int
    catalog_id: int
    catalog_name: str
    name: str
    price: Optional[float]
    is_best_price: bool


class ProductMatchResponse(BaseModel):
    """Group of matching products."""
    match_id: int
    canonical_name: str
    match_method: str
    confidence: float
    products: List[ProductComparisonItem]
    price_range: Optional[float]  # Difference between min and max
    best_price: Optional[float]
    worst_price: Optional[float]


class ComparisonStats(BaseModel):
    """Statistics for comparison."""
    total_products: int
    matched_products: int
    unique_products: int
    total_matches: int
    potential_savings: float


class CompareResponse(BaseModel):
    """Response for catalog comparison."""
    matches: List[ProductMatchResponse]
    stats: ComparisonStats
    catalogs: List[dict]


@router.post("", response_model=CompareResponse)
async def compare_catalogs(
    request: CompareRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Compare products across multiple catalogs.
    
    Finds matching products and compares prices.
    
    Args:
        request: Comparison request with catalog IDs
        user_id: Current user ID
        db: Database session
        
    Returns:
        Comparison results with matches and statistics
    """
    if len(request.catalog_ids) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 catalogs required for comparison"
        )
    
    # Verify catalogs exist and belong to user
    catalogs = db.query(Catalog).filter(
        Catalog.id.in_(request.catalog_ids),
        Catalog.user_id == user_id
    ).all()
    
    if len(catalogs) != len(request.catalog_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more catalogs not found"
        )
    
    # Find matches
    matching_service = ProductMatchingService()
    matches = await matching_service.find_matches(
        db=db,
        catalog_ids=request.catalog_ids,
        user_id=user_id,
        use_ai=request.use_ai
    )
    
    # Build response
    match_responses = []
    total_matched_products = 0
    potential_savings = 0.0
    
    for match in matches:
        # Get products with catalog info
        products_data = []
        prices = []
        
        for member in match.members:
            product = member.product
            catalog = product.catalog
            
            products_data.append(ProductComparisonItem(
                product_id=product.id,
                catalog_id=catalog.id,
                catalog_name=catalog.name,
                name=product.name,
                price=float(product.price) if product.price else None,
                is_best_price=member.is_best_price
            ))
            
            if product.price:
                prices.append(float(product.price))
        
        total_matched_products += len(products_data)
        
        # Calculate price range
        best_price = min(prices) if prices else None
        worst_price = max(prices) if prices else None
        price_range = (worst_price - best_price) if (best_price and worst_price) else None
        
        if price_range:
            potential_savings += price_range
        
        match_responses.append(ProductMatchResponse(
            match_id=match.id,
            canonical_name=match.canonical_name,
            match_method=match.match_method,
            confidence=float(match.confidence),
            products=products_data,
            price_range=price_range,
            best_price=best_price,
            worst_price=worst_price
        ))
    
    # Get total products
    total_products = db.query(Product).filter(
        Product.catalog_id.in_(request.catalog_ids)
    ).count()
    
    unique_products = total_products - total_matched_products + len(matches)
    
    stats = ComparisonStats(
        total_products=total_products,
        matched_products=total_matched_products,
        unique_products=unique_products,
        total_matches=len(matches),
        potential_savings=potential_savings
    )
    
    catalog_info = [
        {"id": c.id, "name": c.name, "product_count": c.product_count}
        for c in catalogs
    ]
    
    return CompareResponse(
        matches=match_responses,
        stats=stats,
        catalogs=catalog_info
    )


@router.get("/matches/{match_id}", response_model=ProductMatchResponse)
async def get_match(
    match_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get details of a specific product match.
    
    Args:
        match_id: Product match ID
        user_id: Current user ID
        db: Database session
        
    Returns:
        Match details with all products
    """
    match = db.query(ProductMatch).filter(
        ProductMatch.id == match_id,
        ProductMatch.user_id == user_id
    ).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Build response
    products_data = []
    prices = []
    
    for member in match.members:
        product = member.product
        catalog = product.catalog
        
        products_data.append(ProductComparisonItem(
            product_id=product.id,
            catalog_id=catalog.id,
            catalog_name=catalog.name,
            name=product.name,
            price=float(product.price) if product.price else None,
            is_best_price=member.is_best_price
        ))
        
        if product.price:
            prices.append(float(product.price))
    
    best_price = min(prices) if prices else None
    worst_price = max(prices) if prices else None
    price_range = (worst_price - best_price) if (best_price and worst_price) else None
    
    return ProductMatchResponse(
        match_id=match.id,
        canonical_name=match.canonical_name,
        match_method=match.match_method,
        confidence=float(match.confidence),
        products=products_data,
        price_range=price_range,
        best_price=best_price,
        worst_price=worst_price
    )
