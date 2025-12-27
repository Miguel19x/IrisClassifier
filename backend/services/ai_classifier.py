"""
AI classifier using Ollama.

Provides AI-powered product classification with automatic
fallback to range-based classification.
"""
import logging
from typing import List, Optional
import httpx

from config import get_settings
from core.exceptions import AIServiceUnavailable
from .fallback_classifier import ClassificationResult

logger = logging.getLogger(__name__)
settings = get_settings()


class AIClassifier:
    """
    AI-powered classifier using Ollama LLM.
    
    Sends product information to Ollama for intelligent
    classification with context understanding.
    """
    
    def __init__(self):
        self.ollama_url = settings.ollama_url
        self.model = settings.ollama_model
        self.timeout = settings.ollama_timeout
        self.max_retries = settings.ollama_max_retries
    
    async def classify(
        self, 
        product, 
        price_ranges: List
    ) -> ClassificationResult:
        """
        Classify a product using AI.
        
        Args:
            product: Product object
            price_ranges: List of available price ranges
            
        Returns:
            ClassificationResult: AI classification result
            
        Raises:
            AIServiceUnavailable: If Ollama is not available
        """
        # Build prompt
        prompt = self._build_prompt(product, price_ranges)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False
                    }
                )
                
                if response.status_code != 200:
                    raise AIServiceUnavailable(
                        f"Ollama returned status {response.status_code}"
                    )
                
                result = response.json()
                classification = self._parse_response(
                    result.get("response", ""),
                    product,
                    price_ranges
                )
                
                return classification
                
        except httpx.TimeoutException:
            logger.warning("ollama_timeout")
            raise AIServiceUnavailable("Ollama request timed out")
        except httpx.ConnectError:
            logger.warning("ollama_unavailable")
            raise AIServiceUnavailable("Cannot connect to Ollama")
        except Exception as e:
            logger.error(
                "ollama_error",
                extra={"error": str(e)},
                exc_info=True
            )
            raise AIServiceUnavailable(str(e))
    
    def _build_prompt(self, product, price_ranges: List) -> str:
        """Build classification prompt for Ollama."""
        ranges_text = "\n".join([
            f"- {r.name}: ${r.min_price} - ${r.max_price if r.max_price else 'unlimited'}"
            for r in price_ranges
        ])
        
        prompt = f"""You are a product price classifier. Given a product and price ranges, classify the product into the most appropriate range.

Product: {product.name}
Price: ${product.price}

Available Price Ranges:
{ranges_text}

Respond with ONLY the name of the most appropriate price range. No explanation needed."""
        
        return prompt
    
    def _parse_response(
        self, 
        response: str, 
        product,
        price_ranges: List
    ) -> ClassificationResult:
        """Parse Ollama response and match to price range."""
        response_clean = response.strip().lower()
        
        # Try to match response to a price range name
        for price_range in price_ranges:
            if price_range.name.lower() in response_clean:
                return ClassificationResult(
                    product_id=product.id,
                    price_range_id=price_range.id,
                    price_range_name=price_range.name,
                    method='ai',
                    confidence=0.85  # AI confidence
                )
        
        # If no match, return unclassified
        logger.warning(
            "ai_no_match",
            extra={
                "product_id": product.id,
                "response": response
            }
        )
        return ClassificationResult(
            product_id=product.id,
            price_range_id=None,
            price_range_name=None,
            method='ai',
            confidence=0.0
        )
    
    async def check_availability(self) -> bool:
        """Check if Ollama service is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_url}/api/tags")
                return response.status_code == 200
        except:
            return False
