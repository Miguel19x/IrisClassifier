"""
Gemini Vision-based extractor for catalog images.

Uses Gemini 2.0 Flash for intelligent image analysis,
with fallback to traditional OCR if Gemini is unavailable.
"""
import logging
from typing import List

from services.extractors.base import BaseExtractor, RawProduct
from services.gemini_vision_service import get_gemini_service, GeminiVisionService
from core.exceptions import FileProcessingError
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiExtractor(BaseExtractor):
    """
    Intelligent image extractor using Gemini Vision API.
    
    Primary extractor for catalog images. Falls back to OCR
    if Gemini API is not configured or fails.
    """
    
    SUPPORTED_TYPES = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/bmp',
    ]
    
    def __init__(self):
        """Initialize Gemini extractor."""
        super().__init__()
        self._gemini_service: GeminiVisionService = None
        self._ocr_fallback = None
    
    def _get_gemini_service(self) -> GeminiVisionService:
        """Lazy load Gemini service."""
        if self._gemini_service is None:
            self._gemini_service = get_gemini_service()
        return self._gemini_service
    
    def _get_ocr_fallback(self):
        """Lazy load OCR fallback."""
        if self._ocr_fallback is None:
            from services.extractors.ocr_extractor import OCRExtractor
            self._ocr_fallback = OCRExtractor()
        return self._ocr_fallback
    
    def supports(self, mime_type: str) -> bool:
        """
        Check if this extractor supports the given MIME type.
        
        Args:
            mime_type: MIME type to check
            
        Returns:
            True if supported, False otherwise
        """
        return mime_type in self.SUPPORTED_TYPES
    
    async def extract(self, file_content: bytes, mime_type: str = "image/jpeg") -> List[RawProduct]:
        """
        Extract products from image using Gemini Vision.
        
        Falls back to OCR if Gemini is unavailable or fails.
        
        Args:
            file_content: Image file content as bytes
            mime_type: MIME type of the image
            
        Returns:
            List of extracted products
        """
        # Check if Gemini is configured
        if not settings.gemini_api_key:
            logger.warning("Gemini API key not configured, falling back to OCR")
            return await self._fallback_to_ocr(file_content)
        
        try:
            # Try Gemini Vision first
            service = self._get_gemini_service()
            
            logger.info("gemini_extraction_started", extra={"mime_type": mime_type})
            
            analysis = await service.analyze_image(file_content, mime_type)
            products = service.extract_products(analysis)
            
            if not products:
                logger.warning("Gemini found no products, trying OCR fallback")
                return await self._fallback_to_ocr(file_content)
            
            # Convert to RawProduct format
            raw_products = []
            catalog_type = analysis.get("catalog_info", {}).get("type", "price_list")
            
            for product in products:
                # Build columns dict from all available data
                columns = {}
                if product.brand:
                    columns["brand"] = product.brand
                if product.category:
                    columns["category"] = product.category
                if product.description:
                    columns["description"] = product.description
                if product.additional_data:
                    columns.update(product.additional_data)
                
                raw_products.append(RawProduct(
                    name=product.name,
                    price_text=product.price_text,
                    raw_line=f"{product.name} - {product.price_text}",
                    columns=columns if columns else None,
                    catalog_type=catalog_type
                ))
            
            logger.info(
                "gemini_extraction_complete",
                extra={
                    "products_extracted": len(raw_products),
                    "catalog_type": catalog_type
                }
            )
            
            return raw_products
            
        except ValueError as e:
            # API key not configured
            logger.warning(f"Gemini not available: {e}")
            return await self._fallback_to_ocr(file_content)
            
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}", exc_info=True)
            # Try fallback
            try:
                return await self._fallback_to_ocr(file_content)
            except Exception as ocr_error:
                logger.error(f"OCR fallback also failed: {ocr_error}")
                raise FileProcessingError(f"Image extraction failed: {str(e)}")
    
    async def _fallback_to_ocr(self, file_content: bytes) -> List[RawProduct]:
        """
        Fallback to OCR extraction.
        
        Args:
            file_content: Image file content
            
        Returns:
            List of products from OCR
        """
        logger.info("Using OCR fallback for image extraction")
        ocr = self._get_ocr_fallback()
        return await ocr.extract(file_content)
