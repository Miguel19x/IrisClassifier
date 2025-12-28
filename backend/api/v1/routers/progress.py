"""
Progress tracking API router.

Provides endpoints to check catalog processing progress.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from database.models import PriceList, ProcessingLog
from api.dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter()


class ProgressResponse(BaseModel):
    """Response for catalog processing progress."""
    catalog_id: int
    status: str
    total_pages: int
    pages_processed: int
    current_batch: int
    total_batches: int
    products_extracted: int
    progress_percent: float
    progress_message: Optional[str] = None
    error_message: Optional[str] = None


@router.get("/catalogs/{catalog_id}/progress", response_model=ProgressResponse)
async def get_catalog_progress(
    catalog_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get processing progress for a PriceList.
    
    Returns real-time progress information including:
    - Pages processed / total pages
    - Current batch / total batches
    - Products extracted so far
    - Progress percentage
    """
    # Get catalog and verify ownership
    catalog = db.get(PriceList, catalog_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado")
    
    if PriceList.user_id != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Get latest processing log
    log = db.query(ProcessingLog).filter(
        ProcessingLog.catalog_id == catalog_id
    ).order_by(ProcessingLog.created_at.desc()).first()
    
    if not log:
        return ProgressResponse(
            catalog_id=catalog_id,
            status=PriceList.status,
            total_pages=0,
            pages_processed=0,
            current_batch=0,
            total_batches=0,
            products_extracted=0,
            progress_percent=0.0,
            progress_message="Iniciando procesamiento..."
        )
    
    # Calculate progress percentage
    progress_percent = 0.0
    if log.total_pages > 0:
        progress_percent = (log.pages_processed / log.total_pages) * 100
    elif log.total_batches > 0:
        progress_percent = (log.current_batch / log.total_batches) * 100
    
    return ProgressResponse(
        catalog_id=catalog_id,
        status=log.status,
        total_pages=log.total_pages,
        pages_processed=log.pages_processed,
        current_batch=log.current_batch,
        total_batches=log.total_batches,
        products_extracted=log.products_extracted,
        progress_percent=round(progress_percent, 1),
        progress_message=log.progress_message,
        error_message=log.error_message
    )
