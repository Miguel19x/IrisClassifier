"""
Gemini Vision Service for intelligent image analysis.

Uses Google's Gemini 2.0 Flash model for:
- Extracting structured data from catalog images
- Understanding product listings, prices, and descriptions
- Handling various catalog formats automatically
"""
import logging
import base64
import json
import re
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

from config import get_settings
from services.rate_limiter import get_rate_limiter

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ExtractedProduct:
    """Product extracted from image analysis."""
    name: str
    price: Optional[float] = None
    price_text: str = ""
    description: str = ""
    brand: str = ""
    category: str = ""
    additional_data: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.additional_data is None:
            self.additional_data = {}


class GeminiVisionService:
    """
    Service for analyzing catalog images using Gemini Vision.
    
    Provides intelligent extraction of products from images,
    understanding layout, tables, and text automatically.
    """
    
    EXTRACTION_PROMPT = """Analiza esta imagen de catálogo de productos y extrae TODOS los productos que puedas identificar.

Para cada producto, extrae:
1. **name**: Nombre completo del producto
2. **price**: Precio numérico (solo el número, sin símbolos de moneda)
3. **price_text**: Precio original como aparece en la imagen (ej: "$1,234.00")
4. **description**: Descripción o detalles adicionales
5. **brand**: Marca si está visible
6. **category**: Categoría del producto si es identificable
7. **additional_data**: Cualquier otra información relevante (códigos, referencias, etc.)

IMPORTANTE:
- Si no hay precio visible, usa null para price y "" para price_text
- Extrae TODOS los productos visibles, no solo algunos
- Si es una tabla, procesa cada fila como un producto
- Mantén la precisión de los precios

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
    "products": [
        {
            "name": "Nombre del producto",
            "price": 123.45,
            "price_text": "$123.45",
            "description": "Descripción opcional",
            "brand": "Marca opcional",
            "category": "Categoría opcional",
            "additional_data": {"key": "value"}
        }
    ],
    "catalog_info": {
        "type": "price_list|catalog|menu|automotive|other",
        "total_products_found": 5,
        "confidence": 0.95
    }
}"""

    def __init__(self):
        """Initialize Gemini Vision service."""
        self._model = None
        self._configured = False
        self._rate_limiter = get_rate_limiter()
        
    def _ensure_configured(self):
        """Ensure Gemini API is configured."""
        if self._configured:
            return
            
        api_key = settings.gemini_api_key
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY not configured. "
                "Get a free key at https://ai.google.dev"
            )
        
        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel(
            model_name=settings.gemini_model,
            generation_config={
                "temperature": 0.1,  # Low temperature for consistent extraction
                "top_p": 0.95,
                "max_output_tokens": 8192,
            },
            safety_settings={
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )
        self._configured = True
        logger.info(f"Gemini Vision configured with model: {settings.gemini_model}")
    
    async def analyze_image(
        self, 
        image_data: bytes,
        mime_type: str = "image/jpeg",
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze an image and extract product information.
        
        Uses rate limiting to prevent 429 errors.
        
        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image
            custom_prompt: Optional custom prompt to use
            
        Returns:
            Dictionary with extracted products and catalog info
        """
        self._ensure_configured()
        
        # Execute with rate limiting and retry logic
        return await self._rate_limiter.execute_with_retry(
            self._analyze_image_internal,
            image_data,
            mime_type,
            custom_prompt
        )
    
    async def _analyze_image_internal(
        self,
        image_data: bytes,
        mime_type: str,
        custom_prompt: Optional[str]
    ) -> Dict[str, Any]:
        """
        Internal method to analyze image (called by rate limiter).
        
        Args:
            image_data: Raw image bytes
            mime_type: MIME type of the image
            custom_prompt: Optional custom prompt to use
            
        Returns:
            Dictionary with extracted products and catalog info
        """
        prompt = custom_prompt or self.EXTRACTION_PROMPT
        
        try:
            # Create image part for the API
            image_part = {
                "inline_data": {
                    "mime_type": mime_type,
                    "data": base64.b64encode(image_data).decode("utf-8")
                }
            }
            
            # Generate response
            response = await self._model.generate_content_async(
                [prompt, image_part],
                request_options={"timeout": settings.gemini_timeout}
            )
            
            # Parse response
            result = self._parse_response(response.text)
            
            logger.info(
                "gemini_image_analyzed",
                extra={
                    "products_found": len(result.get("products", [])),
                    "catalog_type": result.get("catalog_info", {}).get("type", "unknown")
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini analysis failed: {e}", exc_info=True)
            raise
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse Gemini response text to extract JSON.
        
        Args:
            response_text: Raw response from Gemini
            
        Returns:
            Parsed dictionary with products
        """
        # Try to extract JSON from response
        text = response_text.strip()
        
        # Remove markdown code blocks if present
        if text.startswith("```"):
            # Find the JSON content between code blocks
            match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
            if match:
                text = match.group(1).strip()
        
        try:
            result = json.loads(text)
            return result
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
            
            logger.warning(f"Could not parse Gemini response as JSON: {text[:200]}")
            return {"products": [], "catalog_info": {"type": "unknown", "error": "parse_failed"}}
    
    async def analyze_images_batch(
        self,
        images: List[tuple[bytes, str]],
        custom_prompt: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze multiple images in a batch with rate limiting.
        
        Args:
            images: List of (image_data, mime_type) tuples
            custom_prompt: Optional custom prompt to use
            
        Returns:
            List of analysis results, one per image
        """
        results = []
        
        logger.info(
            "gemini_batch_processing_started",
            extra={"total_images": len(images)}
        )
        
        for idx, (image_data, mime_type) in enumerate(images, 1):
            try:
                result = await self.analyze_image(image_data, mime_type, custom_prompt)
                results.append(result)
                
                logger.debug(
                    "gemini_batch_image_processed",
                    extra={"image": idx, "total": len(images)}
                )
                
            except Exception as e:
                logger.warning(
                    f"Failed to analyze image {idx}/{len(images)}: {e}"
                )
                # Add empty result to maintain index alignment
                results.append({"products": [], "catalog_info": {"error": str(e)}})
        
        logger.info(
            "gemini_batch_processing_completed",
            extra={
                "total_images": len(images),
                "successful": sum(1 for r in results if r.get("products"))
            }
        )
        
        return results
    
    def extract_products(self, analysis_result: Dict[str, Any]) -> List[ExtractedProduct]:
        """
        Convert analysis result to list of ExtractedProduct objects.
        
        Args:
            analysis_result: Result from analyze_image
            
        Returns:
            List of ExtractedProduct objects
        """
        products = []
        
        for item in analysis_result.get("products", []):
            try:
                price = item.get("price")
                if price is not None:
                    price = float(price)
                
                product = ExtractedProduct(
                    name=str(item.get("name", "")).strip(),
                    price=price,
                    price_text=str(item.get("price_text", "")).strip(),
                    description=str(item.get("description", "")).strip(),
                    brand=str(item.get("brand", "")).strip(),
                    category=str(item.get("category", "")).strip(),
                    additional_data=item.get("additional_data", {})
                )
                
                if product.name:  # Only add products with a name
                    products.append(product)
                    
            except Exception as e:
                logger.warning(f"Error parsing product: {e}")
                continue
        
        return products


# Singleton instance
_gemini_service: Optional[GeminiVisionService] = None


def get_gemini_service() -> GeminiVisionService:
    """Get or create the Gemini Vision service singleton."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiVisionService()
    return _gemini_service
