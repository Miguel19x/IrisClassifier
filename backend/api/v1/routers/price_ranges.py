"""
Price Ranges API router.

Handles price range CRUD operations.
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

from database.connection import get_db
from database.models import PriceRange
from api.v1.schemas.schemas import PriceRangeCreate, PriceRangeUpdate, PriceRangeResponse
from api.dependencies import get_current_user_id
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/price-ranges", response_model=list[PriceRangeResponse])
def list_price_ranges(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    List all price ranges for the current user.
    
    Returns ranges ordered by display_order.
    """
    query = select(PriceRange).where(
        PriceRange.user_id == user_id
    ).order_by(PriceRange.display_order)
    
    ranges = db.execute(query).scalars().all()
    return [PriceRangeResponse.model_validate(r) for r in ranges]


@router.post("/price-ranges", response_model=PriceRangeResponse, status_code=201)
def create_price_range(
    range_data: PriceRangeCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a new price range.
    
    Validates that min_price <= max_price.
    """
    # Validate price range
    if range_data.max_price and range_data.min_price:
        if range_data.max_price < range_data.min_price:
            from core.exceptions import ValidationError
            raise ValidationError(
                "max_price must be greater than or equal to min_price"
            )
    
    price_range = PriceRange(
        user_id=user_id,
        **range_data.model_dump()
    )
    
    db.add(price_range)
    db.commit()
    db.refresh(price_range)
    
    logger.info(
        "price_range_created",
        extra={
            "range_id": price_range.id,
            "name": price_range.name
        }
    )
    
    return PriceRangeResponse.model_validate(price_range)


@router.put("/price-ranges/{range_id}", response_model=PriceRangeResponse)
def update_price_range(
    range_id: int,
    update_data: PriceRangeUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a price range.
    
    Only updates provided fields.
    """
    price_range = db.get(PriceRange, range_id)
    if not price_range:
        raise NotFoundError("PriceRange", range_id)
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(price_range, field, value)
    
    # Validate updated range
    if price_range.max_price and price_range.min_price:
        if price_range.max_price < price_range.min_price:
            from core.exceptions import ValidationError
            raise ValidationError(
                "max_price must be greater than or equal to min_price"
            )
    
    db.commit()
    db.refresh(price_range)
    
    logger.info(
        "price_range_updated",
        extra={
            "range_id": range_id,
            "updated_fields": list(update_dict.keys())
        }
    )
    
    return PriceRangeResponse.model_validate(price_range)


@router.delete("/price-ranges/{range_id}")
def delete_price_range(
    range_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a price range.
    
    Products using this range will have their price_range_id set to NULL.
    """
    price_range = db.get(PriceRange, range_id)
    if not price_range:
        raise NotFoundError("PriceRange", range_id)
    
    db.delete(price_range)
    db.commit()
    
    logger.info("price_range_deleted", extra={"range_id": range_id})
    
    return {"message": "Price range deleted successfully"}
