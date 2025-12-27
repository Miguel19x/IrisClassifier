"""
Database connection with optimized pooling.

Provides sync database session management with proper
connection pooling for production use.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool, StaticPool

from config import get_settings

settings = get_settings()

# Determine if using SQLite
is_sqlite = settings.database_url.startswith("sqlite")

# Create engine with appropriate configuration
if is_sqlite:
    # SQLite configuration (development)
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=settings.log_level == "DEBUG",
    )
else:
    # PostgreSQL configuration (production)
    engine = create_engine(
        settings.database_url,
        poolclass=QueuePool,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=True,
        echo=settings.log_level == "DEBUG",
    )

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """
    Dependency for getting database session.
    
    Yields:
        Session: Database session.
    
    Example:
        >>> from fastapi import Depends
        >>> def get_products(db: Session = Depends(get_db)):
        ...     return db.query(Product).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
