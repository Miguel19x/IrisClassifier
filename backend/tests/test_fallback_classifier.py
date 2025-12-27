"""
Tests for fallback classifier.
"""
import pytest
from decimal import Decimal
from services.fallback_classifier import FallbackClassifier


class MockProduct:
    """Mock product for testing."""
    def __init__(self, id: int, price: float = None):
        self.id = id
        self.price = Decimal(str(price)) if price else None


class TestFallbackClassifier:
    """Test fallback classifier functionality."""
    
    def test_classify_in_range(self, sample_price_ranges):
        """Test classification of product within a range."""
        classifier = FallbackClassifier()
        product = MockProduct(1, price=15.0)
        
        result = classifier.classify(product, sample_price_ranges)
        
        assert result.product_id == 1
        assert result.price_range_name == "Cheap"
        assert result.method == "fallback"
        assert result.confidence == 1.0
    
    def test_classify_medium_range(self, sample_price_ranges):
        """Test classification in medium range."""
        classifier = FallbackClassifier()
        product = MockProduct(2, price=35.0)
        
        result = classifier.classify(product, sample_price_ranges)
        
        assert result.price_range_name == "Medium"
        assert result.confidence == 1.0
    
    def test_classify_expensive(self, sample_price_ranges):
        """Test classification in expensive range (no upper limit)."""
        classifier = FallbackClassifier()
        product = MockProduct(3, price=100.0)
        
        result = classifier.classify(product, sample_price_ranges)
        
        assert result.price_range_name == "Expensive"
        assert result.confidence == 1.0
    
    def test_classify_no_price(self, sample_price_ranges):
        """Test classification of product without price."""
        classifier = FallbackClassifier()
        product = MockProduct(4, price=None)
        
        result = classifier.classify(product, sample_price_ranges)
        
        assert result.price_range_id is None
        assert result.price_range_name is None
        assert result.confidence == 0.0
    
    def test_classify_boundary(self, sample_price_ranges):
        """Test classification at range boundaries."""
        classifier = FallbackClassifier()
        
        # Exactly at boundary (20.0)
        product = MockProduct(5, price=20.0)
        result = classifier.classify(product, sample_price_ranges)
        
        # Should match Medium (20-50)
        assert result.price_range_name == "Medium"
    
    def test_classify_no_matching_range(self, db_session):
        """Test classification when no range matches."""
        from database.models import PriceRange
        
        # Create range that doesn't cover the price
        ranges = [
            PriceRange(
                user_id=1,
                name="Only 10-20",
                min_price=10,
                max_price=20,
                color="#00FF00",
                display_order=0
            )
        ]
        
        classifier = FallbackClassifier()
        product = MockProduct(6, price=5.0)  # Below range
        
        result = classifier.classify(product, ranges)
        
        assert result.price_range_id is None
        assert result.confidence == 0.0
