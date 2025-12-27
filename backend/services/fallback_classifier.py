"""
Fallback classifier using price ranges.

Provides simple range-based classification when AI is unavailable.
"""
import logging
from decimal import Decimal
from typing import List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ClassificationResult:
    """
    Result of product classification.
    
    Attributes:
        product_id: ID of the product
        price_range_id: ID of the assigned price range
        price_range_name: Name of the price range
        method: Classification method used
        confidence: Confidence score (0-1)
    """
    product_id: int
    price_range_id: Optional[int]
    price_range_name: Optional[str]
    method: str
    confidence: float


class FallbackClassifier:
    """
    Simple range-based classifier.
    
    Classifies products by matching their price against
    configured price ranges. Always available as fallback
    when AI service is unavailable.
    """
    
    def classify(self, product, price_ranges: List) -> ClassificationResult:
        """
        Classify a product using price ranges.
        
        Args:
            product: Product object with price attribute
            price_ranges: List of PriceRange objects
            
        Returns:
            ClassificationResult: Classification result
        """
        if not product.price:
            logger.warning(
                "product_no_price",
                extra={"product_id": product.id}
            )
            return ClassificationResult(
                product_id=product.id,
                price_range_id=None,
                price_range_name=None,
                method='fallback',
                confidence=0.0
            )
        
        price = Decimal(str(product.price))
        
        # Find matching range
        for price_range in sorted(price_ranges, key=lambda r: r.min_price or 0):
            min_price = price_range.min_price or Decimal('0')
            max_price = price_range.max_price
            
            # Check if price falls in range
            if max_price is None:
                # No upper limit
                if price >= min_price:
                    return ClassificationResult(
                        product_id=product.id,
                        price_range_id=price_range.id,
                        price_range_name=price_range.name,
                        method='fallback',
                        confidence=1.0  # Exact match
                    )
            else:
                # Has upper limit
                if min_price <= price <= max_price:
                    return ClassificationResult(
                        product_id=product.id,
                        price_range_id=price_range.id,
                        price_range_name=price_range.name,
                        method='fallback',
                        confidence=1.0  # Exact match
                    )
        
        # No range found
        logger.warning(
            "product_no_range_match",
            extra={
                "product_id": product.id,
                "price": float(price)
            }
        )
        return ClassificationResult(
            product_id=product.id,
            price_range_id=None,
            price_range_name=None,
            method='fallback',
            confidence=0.0
        )
