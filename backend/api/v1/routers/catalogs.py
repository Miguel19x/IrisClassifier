"""
Catalogs API router.

Handles catalog listing and management.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from database.connection import get_db
from database.models import Catalog
from api.v1.schemas.schemas import CatalogList, CatalogResponse
from api.dependencies import get_current_user_id
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/catalogs", response_model=CatalogList)
def list_catalogs(
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    List catalogs for the current user.
    
    Supports filtering by status and pagination.
    Returns catalogs ordered by creation date (newest first).
    """
    # Build query
    query = select(Catalog).where(Catalog.user_id == user_id)
    
    if status:
        query = query.where(Catalog.status == status)
    
    query = query.order_by(Catalog.created_at.desc())
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    catalogs = db.execute(query).scalars().all()
    
    return CatalogList(
        catalogs=[CatalogResponse.model_validate(c) for c in catalogs],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/catalogs/{catalog_id}", response_model=CatalogResponse)
def get_catalog(
    catalog_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get a specific catalog by ID.
    
    Returns 404 if catalog not found or doesn't belong to user.
    """
    catalog = db.get(Catalog, catalog_id)
    
    if not catalog or catalog.user_id != MOCK_USER_ID:
        raise NotFoundError("Catalog", catalog_id)
    
    return CatalogResponse.model_validate(catalog)


@router.post("/catalogs/{catalog_id}/reclassify")
async def reclassify_catalog(
    catalog_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Reclassify all products in a catalog.
    
    Triggers re-classification using current price ranges.
    Returns 202 Accepted as processing is async.
    """
    catalog = db.get(Catalog, catalog_id)
    
    if not catalog or catalog.user_id != MOCK_USER_ID:
        raise NotFoundError("Catalog", catalog_id)
    
    # TODO: Implement actual reclassification logic
    # This would typically:
    # 1. Get all products for this catalog
    # 2. Get current price ranges
    # 3. Run classification service
    # 4. Update products
    
    logger.info(
        "reclassification_requested",
        extra={"catalog_id": catalog_id}
    )
    
    return {
        "message": "Reclassification started",
        "catalog_id": catalog_id,
        "status": "processing"
    }
