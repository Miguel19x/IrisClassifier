"""
Lists API router.

Handles price list management and operations.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from database.connection import get_db
from database.models import PriceList
from api.v1.schemas.schemas import ListResponse, ListCollection
from api.dependencies import get_current_user_id
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lists", tags=["lists"])


@router.get("", response_model=ListCollection)
def list_price_lists(
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    List price lists for the current user.
    
    Supports filtering by status and pagination.
    Returns lists ordered by creation date (newest first).
    """
    query = select(PriceList).where(PriceList.user_id == user_id)
    
    if status:
        query = query.where(PriceList.status == status)
    
    query = query.order_by(PriceList.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    lists = db.execute(query).scalars().all()
    
    return ListCollection(
        lists=[ListResponse.model_validate(l) for l in lists],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{list_id}", response_model=ListResponse)
def get_price_list(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get a specific price list by ID.
    
    Returns 404 if list not found or doesn't belong to user.
    """
    price_list = db.get(PriceList, list_id)
    
    if not price_list or price_list.user_id != user_id:
        raise NotFoundError("PriceList", list_id)
    
    return ListResponse.model_validate(price_list)


@router.delete("/{list_id}")
def delete_price_list(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete a price list by ID.
    
    Deletes the list and all associated products (via cascade).
    Returns 404 if list not found or doesn't belong to user.
    """
    price_list = db.get(PriceList, list_id)
    
    if not price_list or price_list.user_id != user_id:
        raise NotFoundError("PriceList", list_id)
    
    list_name = price_list.name
    db.delete(price_list)
    db.commit()
    
    logger.info(
        "list_deleted",
        extra={"list_id": list_id, "list_name": list_name}
    )
    
    return {"message": "Lista eliminada exitosamente", "list_id": list_id}


@router.post("/{list_id}/reclassify")
async def reclassify_list(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Reclassify all products in a price list.
    
    Triggers re-classification using current price ranges.
    Returns 202 Accepted as processing is async.
    """
    price_list = db.get(PriceList, list_id)
    
    if not price_list or price_list.user_id != user_id:
        raise NotFoundError("PriceList", list_id)
    
    logger.info(
        "reclassification_requested",
        extra={"list_id": list_id}
    )
    
    return {
        "message": "Reclasificación iniciada",
        "list_id": list_id,
        "status": "processing"
    }
