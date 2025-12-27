"""
Authentication API router.

Handles user registration, login, and token management.
"""
import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import User
from api.v1.schemas.auth import UserRegister, UserLogin, Token, UserResponse
from api.dependencies import get_current_user
from core.security import hash_password, verify_password, create_access_token
from core.exceptions import UnauthorizedError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """
    Register a new user.
    
    Creates a new user account with hashed password.
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        is_active=True
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    logger.info("user_registered", extra={"user_id": user.id, "email": user.email})
    
    return UserResponse.model_validate(user)


@router.post("/login", response_model=Token)
def login(
    credentials: UserLogin,
    db: Session = Depends(get_db)
):
    """
    Login and get JWT token.
    
    Validates credentials and returns access token.
    """
    # Find user
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise UnauthorizedError("Invalid email or password")
    
    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")
    
    # Check if user is active
    if not user.is_active:
        raise UnauthorizedError("User account is disabled")
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(days=7)  # Token válido por 7 días
    )
    
    logger.info("user_logged_in", extra={"user_id": user.id, "email": user.email})
    
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user information.
    
    Requires valid JWT token.
    """
    return UserResponse.model_validate(current_user)
