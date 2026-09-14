"""
Markov Chain Suggestions API router.

Provides predictive autocomplete suggestions for product search
using a lightweight in-memory Markov Chain model.
"""
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.connection import get_db
from api.dependencies import get_current_user_id
from services.markov_suggest_service import get_markov_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/markov", tags=["markov"])


@router.get("/suggest")
def get_suggestions(
    q: str = Query(..., min_length=1, max_length=200, description="Search prefix"),
    limit: int = Query(8, ge=1, le=20, description="Max suggestions"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get predictive search suggestions based on Markov Chain model.
    
    The model builds word-level bigrams from all MasterProduct data
    (codes, descriptions, brands) and predicts likely completions
    as the user types.
    
    Args:
        q: The text prefix to generate suggestions for
        limit: Maximum number of suggestions to return (default 8)
    
    Returns:
        dict with suggestions list and input prefix
    """
    service = get_markov_service()

    # Ensure model is built/refreshed
    service.build_model(db)

    suggestions = service.suggest(q, limit=limit)

    return {
        "suggestions": suggestions,
        "prefix": q,
        "count": len(suggestions),
    }


@router.get("/stats")
def get_model_stats(
    user_id: int = Depends(get_current_user_id),
):
    """
    Get Markov model statistics (debug/monitoring endpoint).
    
    Returns vocabulary size, transition count, cache age, etc.
    """
    service = get_markov_service()
    return service.get_stats()
