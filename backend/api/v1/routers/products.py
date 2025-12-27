"""
Products API router.

Handles product listing, updating, and deletion.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from database.connection import get_db
from database.models import Product, PriceRange
from api.v1.schemas.schemas import ProductList, ProductResponse, ProductUpdate
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/products", response_model=ProductList)
def list_products(
    catalog_id: Optional[int] = Query(None, description="Filter by catalog ID"),
    price_range_id: Optional[int] = Query(None, description="Filter by price range"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    List products with optional filters.
    
    Supports filtering by catalog, price range, and price.
    Returns paginated results.
    """
    # Build query
    query = select(Product)
    
    if catalog_id:
        query = query.where(Product.catalog_id == catalog_id)
    if price_range_id:
        query = query.where(Product.price_range_id == price_range_id)
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    products = db.execute(query).scalars().all()
    
    # Enrich with price range names
    products_data = []
    for product in products:
        product_dict = ProductResponse.model_validate(product).model_dump()
        if product.price_range_id:
            price_range = db.get(PriceRange, product.price_range_id)
            if price_range:
                product_dict['price_range_name'] = price_range.name
        products_data.append(ProductResponse(**product_dict))
    
    return ProductList(
        products=products_data,
        total=total,
        page=page,
        page_size=page_size
    )


@router.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    update_data: ProductUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a product.
    
    Allows updating name, price, price_range_id, and category_id.
    """
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product", product_id)
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(product, field, value)
    
    # Mark as manually classified if price_range changed
    if 'price_range_id' in update_dict:
        product.classification_method = 'manual'
        product.confidence_score = 1.0
    
    db.commit()
    db.refresh(product)
    
    logger.info(
        "product_updated",
        extra={
            "product_id": product_id,
            "updated_fields": list(update_dict.keys())
        }
    )
    
    return ProductResponse.model_validate(product)


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a product.
    
    Returns 204 No Content on success.
    """
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product", product_id)
    
    db.delete(product)
    db.commit()
    
    logger.info("product_deleted", extra={"product_id": product_id})
    
    return {"message": "Product deleted successfully"}
