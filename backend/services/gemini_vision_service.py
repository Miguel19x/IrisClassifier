"""
Gemini Vision Service for intelligent document analysis.

Uses Google's Gemini 1.5 Flash model via the google-genai SDK for:
- Native PDF processing (no image conversion needed)
- Extracting structured data from catalogs
- Understanding product listings, prices, and descriptions
- Handling various catalog formats automatically

OPTIMIZED: Uses 1 API call per PDF instead of N calls per page.
"""
import logging
import json
import re
import os
from typing import List, Dict, Optional, Any
from dataclasses import dataclass

from google import genai
from google.genai import types

from config import get_settings
from services.rate_limiter import get_rate_limiter

logger = logging.getLogger(__name__)
settings = get_settings()


# Standard product categories based on common classification
STANDARD_CATEGORIES = """
Categorías estándar:
- AUTOPARTES: Repuestos de vehículos (bases, bombas, cables, filtros, etc.)
- ELECTRONICA: Dispositivos electrónicos
- HOGAR: Artículos para el hogar
- ALIMENTACION: Comida y bebidas
- ROPA: Vestimenta y accesorios
- HERRAMIENTAS: Herramientas manuales y eléctricas
- OTROS: Si no encaja en ninguna categoría anterior
"""


@dataclass
class ExtractedProduct:
    """Product extracted from document analysis."""
    name: str
    code: str = ""
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
    Service for analyzing catalogs using Gemini Vision.
    
    Supports native PDF processing with Gemini 1.5 Flash,
    reducing API calls from N (per page) to 1 (per document).
    """
    
    # Optimized prompt for list extraction
    EXTRACTION_PROMPT = """Actúa como un analista de datos experto en listas de precios.

Analiza esta lista de precios adjunta y extrae TODOS los productos que encuentres.

Para cada producto, extrae los siguientes campos:
1. **code**: Código o referencia del producto (si existe)
2. **name**: Nombre completo del producto
3. **price**: Precio numérico (solo el número, sin símbolos de moneda)
4. **price_text**: Precio original como aparece (ej: "$1,234.00", "199,32")
5. **brand**: Marca del producto (si está visible)
6. **category**: Clasifica usando estas categorías estándar:
   - AUTOPARTES: Repuestos de vehículos
   - ELECTRONICA: Dispositivos electrónicos
   - HOGAR: Artículos para el hogar
   - ALIMENTACION: Comida y bebidas
   - HERRAMIENTAS: Herramientas
   - OTROS: Si no encaja en ninguna
7. **description**: Descripción visual o detalles adicionales

REGLAS IMPORTANTES:
- Extrae ABSOLUTAMENTE TODOS los productos, no solo algunos
- Si es una tabla, cada fila es un producto
- Si no hay precio, usa null para price y "" para price_text
- Mantén la precisión exacta de los precios
- El código puede estar en una columna separada (ej: "CODIGO", "REF", "SKU")

Responde ÚNICAMENTE con JSON válido en este formato:
{
    "products": [
        {
            "code": "3170",
            "name": "ARBOL DE LEVA 4JB1/4JH1T NHR/NKR/JAC",
            "price": 98.01,
            "price_text": "98,01",
            "brand": "CAP",
            "category": "AUTOPARTES",
            "description": "Para vehículos NHR/NKR/JAC"
        }
    ],
    "catalog_info": {
        "type": "price_list",
        "company": "Nombre de la empresa si es visible",
        "date": "Fecha del catálogo si es visible",
        "total_products_found": 50,
        "pages_analyzed": 1
    }
}"""

    # Model to use - Gemini 2.5 Flash (supports native PDF upload)
    MODEL_NAME = "gemini-2.5-flash"

    def __init__(self):
        """Initialize Gemini Vision service."""
        self._client = None
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
        
        # Set environment variable for the SDK
        os.environ["GEMINI_API_KEY"] = api_key
        
        # Create client
        self._client = genai.Client()
        self._configured = True
        logger.info(f"Gemini Vision configured with model: {self.MODEL_NAME}")
    
    async def analyze_pdf(
        self, 
        pdf_data: bytes,
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze an entire PDF document natively.
        
        This is the optimized method - uses 1 API call for the entire PDF
        instead of converting pages to images.
        
        Args:
            pdf_data: Raw PDF bytes
            custom_prompt: Optional custom prompt to use
            
        Returns:
            Dictionary with extracted products and catalog info
        """
        self._ensure_configured()
        
        # Execute with rate limiting and retry logic
        return await self._rate_limiter.execute_with_retry(
            self._analyze_pdf_internal,
            pdf_data,
            custom_prompt
        )
    
    async def _analyze_pdf_internal(
        self,
        pdf_data: bytes,
        custom_prompt: Optional[str]
    ) -> Dict[str, Any]:
        """
        Internal method to analyze PDF (called by rate limiter).
        """
        prompt = custom_prompt or self.EXTRACTION_PROMPT
        
        try:
            # Create PDF part for the API
            pdf_part = types.Part.from_bytes(
                data=pdf_data,
                mime_type="application/pdf"
            )
            
            logger.info(
                "gemini_pdf_analysis_started",
                extra={"pdf_size_mb": round(len(pdf_data) / 1024 / 1024, 2)}
            )
            
            # Generate response - single API call for entire PDF
            response = self._client.models.generate_content(
                model=self.MODEL_NAME,
                contents=[prompt, pdf_part],
                config=types.GenerateContentConfig(
                    temperature=0.1,  # Low for consistent extraction
                    max_output_tokens=65536,  # Large output for many products
                )
            )
            
            # Parse response
            result = self._parse_response(response.text)
            
            products_count = len(result.get("products", []))
            logger.info(
                "gemini_pdf_analysis_completed",
                extra={
                    "products_found": products_count,
                    "catalog_type": result.get("catalog_info", {}).get("type", "unknown")
                }
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Gemini PDF analysis failed: {e}", exc_info=True)
            raise
    
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
        """Internal method to analyze image."""
        prompt = custom_prompt or self.EXTRACTION_PROMPT
        
        try:
            image_part = types.Part.from_bytes(
                data=image_data,
                mime_type=mime_type
            )
            
            response = self._client.models.generate_content(
                model=self.MODEL_NAME,
                contents=[prompt, image_part],
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=8192,
                )
            )
            
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
        """
        text = response_text.strip()
        
        # Remove markdown code blocks if present
        if text.startswith("```"):
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
        
        Note: For PDFs, use analyze_pdf() instead for better efficiency.
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
            except Exception as e:
                logger.warning(f"Failed to analyze image {idx}/{len(images)}: {e}")
                results.append({"products": [], "catalog_info": {"error": str(e)}})
        
        return results
    
    def extract_products(self, analysis_result: Dict[str, Any]) -> List[ExtractedProduct]:
        """
        Convert analysis result to list of ExtractedProduct objects.
        """
        products = []
        
        for item in analysis_result.get("products", []):
            try:
                price = item.get("price")
                if price is not None:
                    price = float(price)
                
                product = ExtractedProduct(
                    name=str(item.get("name", "")).strip(),
                    code=str(item.get("code", "")).strip(),
                    price=price,
                    price_text=str(item.get("price_text", "")).strip(),
                    description=str(item.get("description", "")).strip(),
                    brand=str(item.get("brand", "")).strip(),
                    category=str(item.get("category", "")).strip(),
                    additional_data=item.get("additional_data", {})
                )
                
                if product.name:
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
