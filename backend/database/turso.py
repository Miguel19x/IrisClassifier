"""
Turso Database Integration

Provides abstraction layer to support both local SQLite and Turso cloud database.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

def get_database_url() -> str:
    """
    Get database URL based on environment.
    
    Returns:
        - Turso URL in production (if TURSO_DATABASE_URL is set)
        - Local SQLite URL in development
    """
    turso_url = os.getenv("TURSO_DATABASE_URL")
    
    if turso_url:
        # Turso connection with auth token
        turso_token = os.getenv("TURSO_AUTH_TOKEN")
        if not turso_token:
            raise ValueError("TURSO_AUTH_TOKEN is required when using Turso")
        
        # libsql URL format: libsql://[host]?authToken=[token]
        return f"{turso_url}?authToken={turso_token}"
    
    # Default to local SQLite
    return "sqlite:///./iris.db"


def create_database_engine(database_url: str | None = None):
    """
    Create SQLAlchemy engine for the database.
    
    Args:
        database_url: Optional database URL. If not provided, uses get_database_url()
    
    Returns:
        SQLAlchemy Engine instance
    """
    url = database_url or get_database_url()
    
    if url.startswith("libsql://"):
        # Turso/libsql configuration
        from libsql_experimental import dbapi2 as libsql
        
        engine = create_engine(
            url,
            module=libsql,
            connect_args={
                "check_same_thread": False,
            },
            poolclass=StaticPool,
        )
    else:
        # Local SQLite configuration
        engine = create_engine(
            url,
            connect_args={
                "check_same_thread": False,
            },
            poolclass=StaticPool,
        )
    
    return engine


def get_session_maker(engine):
    """
    Create session maker for database sessions.
    
    Args:
        engine: SQLAlchemy engine
    
    Returns:
        SessionLocal class for creating database sessions
    """
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)
