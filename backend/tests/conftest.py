"""
Pytest configuration and fixtures.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.models import Base


@pytest.fixture(scope="function")
def db_session():
    """
    Create a test database session.
    
    Uses in-memory SQLite for fast tests.
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    yield session
    
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def sample_pdf_content():
    """Sample PDF-like content for testing."""
    return b"%PDF-1.4\nSample Product $10.99\nAnother Item $25.50"


@pytest.fixture
def sample_price_ranges(db_session):
    """Create sample price ranges for testing."""
    from database.models import PriceRange
    
    ranges = [
        PriceRange(
            user_id=1,
            name="Cheap",
            min_price=0,
            max_price=20,
            color="#00FF00",
            display_order=0
        ),
        PriceRange(
            user_id=1,
            name="Medium",
            min_price=20,
            max_price=50,
            color="#FFFF00",
            display_order=1
        ),
        PriceRange(
            user_id=1,
            name="Expensive",
            min_price=50,
            max_price=None,
            color="#FF0000",
            display_order=2
        ),
    ]
    
    for r in ranges:
        db_session.add(r)
    db_session.commit()
    
    return ranges
