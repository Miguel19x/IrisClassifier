"""
Classification service orchestrating AI and fallback classifiers.

Implements Chain of Responsibility pattern for classification.
"""
import logging
from typing import List
from decimal import Decimal

from .ai_classifier import AIClassifier, ClassificationResult
from .fallback_classifier import FallbackClassifier
from .cache_service import LRUCache, generate_cache_key
from core.exceptions import AIServiceUnavailable
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ClassificationService:
    """
    Orchestrates product classification.
    
    Flow:
    1. Check cache → If exists, return
    2. Try AI classification → If fails, continue
    3. Use fallback classification
    4. Save to cache
    """
    
    def __init__(self):
        self.ai_classifier = AIClassifier()
        self.fallback_classifier = FallbackClassifier()
        self.cache = LRUCache[ClassificationResult](
            max_size=settings.cache_max_size,
            ttl_seconds=settings.cache_ttl_seconds
        )
    
    async def classify_products(
        self,
        products: List,
        price_ranges: List
    ) -> List[ClassificationResult]:
        """
        Classify a list of products.
        
        Args:
            products: List of Product objects
            price_ranges: List of PriceRange objects
            
        Returns:
            List[ClassificationResult]: Classification results
        """
        results: List[ClassificationResult] = []
        ai_failures = 0
        
        for product in products:
            try:
                result = await self._classify_single(
                    product,
                    price_ranges,
                    use_ai=(ai_failures < len(products) * 0.5)  # Disable AI if failing too much
                )
                results.append(result)
                
                if result.method != 'ai':
                    ai_failures += 1
                    
            except Exception as e:
                logger.error(
                    "classification_failed",
                    extra={
                        "product_id": product.id,
                        "product_name": product.name,
                        "error": str(e)
                    },
                    exc_info=True
                )
                # Mark as unclassified
                results.append(ClassificationResult(
                    product_id=product.id,
                    price_range_id=None,
                    price_range_name=None,
                    method='error',
                    confidence=0.0
                ))
        
        # Log summary
        methods = [r.method for r in results]
        logger.info(
            "classification_batch_completed",
            extra={
                "total": len(results),
                "by_ai": methods.count('ai'),
                "by_fallback": methods.count('fallback'),
                "errors": methods.count('error'),
            }
        )
        
        return results
    
    async def _classify_single(
        self,
        product,
        price_ranges: List,
        use_ai: bool = True
    ) -> ClassificationResult:
        """Classify a single product."""
        
        # 1. Check cache
        cache_key = generate_cache_key(
            product.name,
            str(product.price),
            [r.id for r in price_ranges]
        )
        cached = self.cache.get(cache_key)
        if cached:
            logger.debug("cache_hit", extra={"product_id": product.id})
            return cached
        
        result: ClassificationResult = None
        
        # 2. Try AI classification
        if use_ai:
            for attempt in range(settings.ollama_max_retries):
                try:
                    result = await self.ai_classifier.classify(product, price_ranges)
                    break
                except AIServiceUnavailable as e:
                    logger.warning(
                        "ai_retry",
                        extra={
                            "attempt": attempt + 1,
                            "max_retries": settings.ollama_max_retries,
                            "error": str(e)
                        }
                    )
                    if attempt == settings.ollama_max_retries - 1:
                        logger.warning("ai_unavailable_using_fallback")
        
        # 3. Fallback to range-based classification
        if result is None or result.price_range_id is None:
            result = self.fallback_classifier.classify(product, price_ranges)
        
        # 4. Save to cache
        self.cache.set(cache_key, result)
        
        return result
    
    def get_cache_stats(self) -> dict:
        """Get cache statistics."""
        return self.cache.get_stats()
