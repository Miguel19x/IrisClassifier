"""
Gemini Vision-based extractor for catalog images.

Uses Gemini 2.0 Flash for intelligent image analysis,
with fallback to traditional OCR if Gemini is unavailable.

After Gemini extraction, applies shared ColumnExtractor refinements
for brand separation and code correlation.
"""
import logging
from typing import List, Optional, Tuple

from services.extractors.base import BaseExtractor, RawProduct
from services.extractors.column_extractor import get_column_extractor
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
    
    After Gemini extraction, applies shared ColumnExtractor refinements:
    - Brand separation from combined code+brand cells
    - Code correlation and validation
    - Subtitle/category detection
    """
    
    SUPPORTED_TYPES = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/bmp',
    ]
    
    def __init__(self):
        """Initialize Gemini extractor with shared ColumnExtractor."""
        super().__init__()
        self._gemini_service: GeminiVisionService = None
        self._ocr_fallback = None
        self.column_extractor = get_column_extractor()
    
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
        Applies ColumnExtractor refinements after extraction.
        
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
            
            # Convert to RawProduct format with refinements
            raw_products = []
            catalog_type = analysis.get("catalog_info", {}).get("type", "price_list")
            
            for product in products:
                # Apply ColumnExtractor refinements
                refined_product = self._refine_product(product, catalog_type)
                if refined_product:
                    raw_products.append(refined_product)
            
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
    
    def _refine_product(self, product, catalog_type: str) -> Optional[RawProduct]:
        """
        Apply ColumnExtractor refinements to a Gemini-extracted product.
        
        Refinements include:
        - Brand separation from code if combined
        - Subtitle/category detection
        - Data validation
        
        Args:
            product: Product extracted by Gemini
            catalog_type: Type of catalog
            
        Returns:
            RawProduct or None if should be skipped
        """
        name = product.name or ""
        price_text = product.price_text or ""
        brand = product.brand or ""
        code = getattr(product, 'code', '') or ""
        
        # Try to extract code from name if not provided
        if not code and name:
            # Sometimes Gemini puts code at the start of name
            parts = name.split(' ', 1)
            if len(parts) == 2 and self._looks_like_code(parts[0]):
                code = parts[0]
                name = parts[1]
        
        # Try to separate brand from code if brand not provided
        if not brand and code:
            code, extracted_brand = self.column_extractor.separate_brand_from_code(code)
            if extracted_brand:
                brand = extracted_brand
        
        # Also try separating brand from name
        if not brand and name:
            name_cleaned, extracted_brand = self.column_extractor.separate_brand_from_code(name)
            if extracted_brand:
                brand = extracted_brand
                # Only update name if brand was at the end
                if name.upper().endswith(extracted_brand):
                    name = name_cleaned
        
        # Check if this is a subtitle row
        if self.column_extractor.is_subtitle_row(name, code, brand, price_text):
            logger.debug(f"Skipping subtitle from Gemini: {name}")
            return None
        
        # Check if should skip
        if self.column_extractor.should_skip_row(name):
            return None
        
        # Skip if no name
        if not name or len(name.strip()) < 2:
            return None
        
        # Build columns dict from all available data
        columns = {}
        if code:
            columns["code"] = code
        if brand:
            columns["brand"] = brand
        if product.category:
            columns["category"] = product.category
        if product.description:
            columns["description"] = product.description
        if product.additional_data:
            columns.update(product.additional_data)
        
        return RawProduct(
            name=name,
            price_text=price_text,
            raw_line=f"{code} | {name} | {brand} | {price_text}".strip(' |'),
            columns=columns if columns else None,
            catalog_type=catalog_type
        )
    
    def _looks_like_code(self, text: str) -> bool:
        """Check if text looks like a product code."""
        if not text or len(text) < 3:
            return False
        
        # Codes typically have letters and numbers mixed
        has_letters = any(c.isalpha() for c in text)
        has_numbers = any(c.isdigit() for c in text)
        
        # And no spaces, limited length
        no_spaces = ' ' not in text
        short_enough = len(text) <= 25
        
        return (has_letters and has_numbers and no_spaces and short_enough) or \
               (text.isalnum() and short_enough)
    
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
