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
    list_id: Optional[int] = Query(None, description="Filter by price list ID"),
    search: Optional[str] = Query(None, min_length=1, max_length=100, description="Search in code, name, brand"),
    status_filter: Optional[str] = Query(None, regex="^(pending|verified)$", description="Filter by status"),
    sort_by: str = Query("index", regex="^(index|alphabetical|brand|price)$", description="Sort order"),
    price_range_id: Optional[int] = Query(None, description="Filter by price range"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(200, ge=1, le=20000, description="Items per page"),
    db: Session = Depends(get_db)
):
    """
    List products with optional filters.
    
    Supports:
    - search: Text search across code, name, and brand
    - status_filter: Filter by verification status (pending/verified)
    - sort_by: Sort order (index, alphabetical, brand, price)
    - list_id: Filter by price list
    - price filters: min_price, max_price
    """
    query = select(Product)
    
    if list_id:
        query = query.where(Product.list_id == list_id)
    
    # Apply search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            (func.lower(Product.code).like(search_term)) |
            (func.lower(Product.name).like(search_term)) |
            (func.lower(Product.brand).like(search_term))
        )
    
    # Apply status filter
    if status_filter:
        query = query.where(Product.status == status_filter)
    
    if price_range_id:
        query = query.where(Product.price_range_id == price_range_id)
    if min_price is not None:
        query = query.where(Product.price >= min_price)
    if max_price is not None:
        query = query.where(Product.price <= max_price)
    
    # Apply sorting
    if sort_by == "index":
        query = query.order_by(Product.row_index.asc())
    elif sort_by == "alphabetical":
        query = query.order_by(func.lower(Product.name).asc(), Product.row_index.asc())
    elif sort_by == "brand":
        query = query.order_by(func.lower(Product.brand).asc(), func.lower(Product.name).asc(), Product.row_index.asc())
    elif sort_by == "price":
        query = query.order_by(Product.price.asc(), Product.row_index.asc())
    
    # Get total count (must match all filters)
    count_query = select(func.count(Product.id))
    if list_id:
        count_query = count_query.where(Product.list_id == list_id)
    if search:
        search_term = f"%{search.lower()}%"
        count_query = count_query.where(
            (func.lower(Product.code).like(search_term)) |
            (func.lower(Product.name).like(search_term)) |
            (func.lower(Product.brand).like(search_term))
        )
    if status_filter:
        count_query = count_query.where(Product.status == status_filter)
    if price_range_id:
        count_query = count_query.where(Product.price_range_id == price_range_id)
    if min_price is not None:
        count_query = count_query.where(Product.price >= min_price)
    if max_price is not None:
        count_query = count_query.where(Product.price <= max_price)
    
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
    
    Returns success message on completion.
    """
    product = db.get(Product, product_id)
    if not product:
        raise NotFoundError("Product", product_id)
    
    db.delete(product)
    db.commit()
    
    logger.info("product_deleted", extra={"product_id": product_id})
    
    return {"message": "Producto eliminado exitosamente"}
