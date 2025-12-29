"""
Gemini Vision PDF extractor.

OPTIMIZED: Uses Gemini 2.5 Flash native PDF support.
Sends entire PDF in a single API call instead of converting pages to images.

This reduces API usage from N calls (per page) to 1 call (per document).
"""
import logging
from typing import List, Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from .base import BaseExtractor, RawProduct
from core.exceptions import FileProcessingError
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiPDFExtractor(BaseExtractor):
    """
    PDF extractor using Gemini Vision with native PDF support.
    
    OPTIMIZED: Uses Gemini 2.5 Flash which can process PDFs directly,
    eliminating the need to convert pages to images.
    
    Benefits:
    - 1 API call per PDF instead of N calls per page
    - Faster processing
    - Lower API costs
    - Better context understanding (sees entire document)
    
    Falls back to traditional pdfplumber if Gemini is unavailable.
    """
    
    def __init__(self):
        """Initialize the Gemini PDF extractor."""
        super().__init__()
        self._gemini_service = None
    
    def _get_gemini_service(self):
        """Lazy load Gemini service."""
        if self._gemini_service is None:
            from services.gemini_vision_service import get_gemini_service
            self._gemini_service = get_gemini_service()
        return self._gemini_service
    
    def supports(self, mime_type: str) -> bool:
        """Check if this extractor supports PDF files."""
        return mime_type == 'application/pdf'
    
    async def extract(self, content: bytes) -> List[RawProduct]:
        """
        Extract products from PDF using Gemini Vision native PDF support.
        
        This is the OPTIMIZED method - sends entire PDF to Gemini 2.5 Flash
        in a single API call.
        
        Args:
            content: PDF file bytes
            
        Returns:
            List of extracted products
        """
        self._log_extraction_start(len(content))
        
        # Check if Gemini is configured
        if not settings.gemini_api_key:
            logger.info("Gemini not configured, using traditional PDF extraction")
            return await self._fallback_extraction(content)
        
        try:
            service = self._get_gemini_service()
            
            logger.info(
                "gemini_native_pdf_processing_started",
                extra={
                    "pdf_size_mb": round(len(content) / 1024 / 1024, 2),
                    "method": "native_pdf"
                }
            )
            
            # Single API call for entire PDF
            analysis = await service.analyze_pdf(content)
            
            products = analysis.get("products", [])
            catalog_info = analysis.get("catalog_info", {})
            
            if not products:
                logger.warning(
                    "gemini_pdf_no_products_found",
                    extra={"catalog_info": catalog_info}
                )
                # Try fallback if no products found
                return await self._fallback_extraction(content)
            
            # Convert to RawProduct format
            all_products = []
            catalog_type = catalog_info.get("type", "price_list")
            
            for idx, product in enumerate(products, 1):
                columns = {}
                
                # Add code if present
                code = product.get("code", "")
                if code:
                    columns["code"] = str(code)
                
                # Add brand if present
                brand = product.get("brand", "")
                if brand:
                    columns["brand"] = str(brand)
                
                # Add category if present
                category = product.get("category", "")
                if category:
                    columns["category"] = str(category)
                
                # Add description if present
                description = product.get("description", "")
                if description:
                    columns["description"] = str(description)
                
                # Add any additional data
                additional = product.get("additional_data", {})
                if additional and isinstance(additional, dict):
                    columns.update(additional)
                
                # Get price text
                price_text = product.get("price_text", "")
                if not price_text and product.get("price"):
                    price_text = str(product.get("price"))
                
                all_products.append(RawProduct(
                    name=str(product.get("name", f"Producto {idx}")).strip(),
                    price_text=str(price_text).strip(),
                    raw_line=f"{code} - {product.get('name', '')} - {price_text}",
                    columns=columns if columns else None,
                    catalog_type=catalog_type
                ))
            
            logger.info(
                "gemini_native_pdf_extraction_complete",
                extra={
                    "total_products": len(all_products),
                    "catalog_type": catalog_type,
                    "company": catalog_info.get("company", "unknown"),
                    "api_calls": 1  # Just 1 API call!
                }
            )
            
            self._log_extraction_complete(len(all_products))
            return all_products
            
        except Exception as e:
            logger.warning(
                f"Gemini native PDF extraction failed: {e}",
                exc_info=True
            )
            # Fallback to traditional extraction
            return await self._fallback_extraction(content)
    
    async def _fallback_extraction(self, content: bytes) -> List[RawProduct]:
        """
        Fallback to traditional pdfplumber extraction.
        
        Args:
            content: PDF file bytes
            
        Returns:
            List of extracted products
        """
        from .pdf_extractor import PDFExtractor
        
        logger.info("Using traditional PDF extraction as fallback")
        traditional_extractor = PDFExtractor()
        return await traditional_extractor.extract(content)
