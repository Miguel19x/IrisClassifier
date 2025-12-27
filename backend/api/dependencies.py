"""
API dependencies for authentication and authorization.

Provides FastAPI dependencies for JWT authentication and user extraction.
"""
import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.security import decode_access_token
from core.exceptions import UnauthorizedError
from database.connection import get_db
from database.models import User

logger = logging.getLogger(__name__)

# HTTP Bearer token scheme
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Args:
        credentials: HTTP Bearer credentials with JWT token.
        db: Database session.
        
    Returns:
        Authenticated User object.
        
    Raises:
        UnauthorizedError: If token is invalid or user not found.
        
    Example:
        >>> @router.get("/protected")
        >>> def protected_route(user: User = Depends(get_current_user)):
        ...     return {"user_id": user.id}
    """
    token = credentials.credentials
    
    # Decode token
    payload = decode_access_token(token)
    if not payload:
        logger.warning("invalid_token_attempt")
        raise UnauthorizedError("Invalid or expired token")
    
    # Extract user_id from token
    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        logger.warning("token_missing_user_id")
        raise UnauthorizedError("Invalid token payload")
    
    # Get user from database
    user = db.get(User, int(user_id))
    if not user:
        logger.warning("token_user_not_found", extra={"user_id": user_id})
        raise UnauthorizedError("User not found")
    
    logger.debug("user_authenticated", extra={"user_id": user.id})
    return user


async def get_current_user_id(
    user: User = Depends(get_current_user)
) -> int:
    """
    Get the current user's ID.
    
    Convenience dependency that returns just the user ID.
    
    Args:
        user: Current authenticated user.
        
    Returns:
        User ID.
        
    Example:
        >>> @router.get("/my-data")
        >>> def get_my_data(user_id: int = Depends(get_current_user_id)):
        ...     return {"user_id": user_id}
    """
    return user.id


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get the current user if authenticated, None otherwise.
    
    Use this for endpoints that work both with and without authentication.
    
    Args:
        credentials: Optional HTTP Bearer credentials.
        db: Database session.
        
    Returns:
        User object if authenticated, None otherwise.
        
    Example:
        >>> @router.get("/public-or-private")
        >>> def mixed_route(user: Optional[User] = Depends(get_optional_user)):
        ...     if user:
        ...         return {"message": f"Hello {user.id}"}
        ...     return {"message": "Hello guest"}
    """
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        if not payload:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        user = db.get(User, int(user_id))
        return user
    except Exception:
        return None
