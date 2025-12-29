"""
Progress tracking API router.

Provides endpoints to check list processing progress.
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
    """Response for list processing progress."""
    list_id: int
    status: str
    total_pages: int
    pages_processed: int
    current_batch: int
    total_batches: int
    products_extracted: int
    progress_percent: float
    progress_message: Optional[str] = None
    error_message: Optional[str] = None


@router.get("/lists/{list_id}/progress", response_model=ProgressResponse)
async def get_list_progress(
    list_id: int,
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
    price_list = db.get(PriceList, list_id)
    if not price_list:
        raise HTTPException(status_code=404, detail="Lista no encontrada")
    
    if price_list.user_id != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    # Get latest processing log
    log = db.query(ProcessingLog).filter(
        ProcessingLog.list_id == list_id
    ).order_by(ProcessingLog.created_at.desc()).first()
    
    if not log:
        return ProgressResponse(
            list_id=list_id,
            status=price_list.status,
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
        list_id=list_id,
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
