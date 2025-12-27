"""
Gemini Vision PDF extractor.

Converts PDF pages to images and uses Gemini Vision
for intelligent extraction of products and data.
"""
import io
import logging
from typing import List, Optional

try:
    from pdf2image import convert_from_bytes
    from pdf2image.exceptions import PDFInfoNotInstalledError
except ImportError:
    convert_from_bytes = None
    PDFInfoNotInstalledError = Exception

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
    PDF extractor using Gemini Vision for intelligent analysis.
    
    Converts PDF pages to images and sends them to Gemini
    for comprehensive understanding of content, layout, and structure.
    
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
        Extract products from PDF using Gemini Vision.
        
        Converts each page to an image and analyzes with Gemini.
        Falls back to traditional extraction if Gemini fails.
        
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
        
        # Try pdf2image conversion
        if convert_from_bytes is None:
            logger.warning("pdf2image not installed, using traditional extraction")
            return await self._fallback_extraction(content)
        
        try:
            # Convert PDF pages to images
            logger.info("gemini_pdf_converting_pages")
            
            try:
                images = convert_from_bytes(
                    content,
                    dpi=150,  # Balance between quality and speed
                    fmt='jpeg'
                )
            except PDFInfoNotInstalledError:
                logger.warning("Poppler not installed, using fallback")
                return await self._fallback_extraction(content)
            except Exception as e:
                logger.warning(f"PDF to image conversion failed: {e}")
                return await self._fallback_extraction(content)
            
            if not images:
                logger.warning("No pages extracted from PDF")
                return await self._fallback_extraction(content)
            
            logger.info(f"gemini_pdf_pages_converted", extra={"pages": len(images)})
            
            # Process pages in batches to reduce API calls
            batch_size = settings.gemini_page_batch_size
            all_products = []
            service = self._get_gemini_service()
            consecutive_failures = 0
            max_consecutive_failures = 2  # After 2 failed batches, fallback to traditional extraction
            pages_processed = 0
            
            # Group pages into batches
            total_batches = (len(images) + batch_size - 1) // batch_size
            
            logger.info(
                "gemini_pdf_batch_processing_started",
                extra={
                    "total_pages": len(images),
                    "batch_size": batch_size,
                    "total_batches": total_batches,
                    "estimated_time_minutes": round((total_batches * batch_size * 6) / 60, 1)
                }
            )
            
            for batch_idx in range(total_batches):
                start_idx = batch_idx * batch_size
                end_idx = min(start_idx + batch_size, len(images))
                batch_images = images[start_idx:end_idx]
                
                # Progress logging with percentage
                progress_percent = round((batch_idx / total_batches) * 100, 1)
                logger.info(
                    "gemini_pdf_batch_started",
                    extra={
                        "batch": batch_idx + 1,
                        "total_batches": total_batches,
                        "pages_in_batch": len(batch_images),
                        "page_range": f"{start_idx + 1}-{end_idx}",
                        "progress_percent": progress_percent,
                        "pages_processed": pages_processed,
                        "total_pages": len(images)
                    }
                )
                
                # Convert batch images to bytes
                batch_data = []
                for page_num_in_batch, image in enumerate(batch_images):
                    img_buffer = io.BytesIO()
                    image.save(img_buffer, format='JPEG', quality=85)
                    img_bytes = img_buffer.getvalue()
                    batch_data.append((img_bytes, "image/jpeg"))
                
                try:
                    # Analyze batch with rate limiting
                    batch_results = await service.analyze_images_batch(batch_data)
                    consecutive_failures = 0  # Reset on success
                    
                    # Process results
                    for page_offset, analysis in enumerate(batch_results):
                        page_num = start_idx + page_offset + 1
                        pages_processed += 1
                        
                        if not analysis.get("products"):
                            # Check if it's a quota error
                            error_info = analysis.get("catalog_info", {}).get("error", "")
                            if "429" in str(error_info) or "quota" in str(error_info).lower():
                                consecutive_failures += 1
                                logger.warning(
                                    "gemini_quota_error_detected",
                                    extra={"page": page_num, "consecutive_failures": consecutive_failures}
                                )
                            continue
                        
                        products = service.extract_products(analysis)
                        catalog_type = analysis.get("catalog_info", {}).get("type", "price_list")
                        
                        # Convert to RawProduct format
                        for product in products:
                            columns = {}
                            if product.brand:
                                columns["brand"] = product.brand
                            if product.category:
                                columns["category"] = product.category
                            if product.description:
                                columns["description"] = product.description
                            if product.additional_data:
                                columns.update(product.additional_data)
                            columns["_page"] = str(page_num)
                            columns["_batch"] = str(batch_idx + 1)
                            
                            all_products.append(RawProduct(
                                name=product.name,
                                price_text=product.price_text,
                                raw_line=f"Page {page_num}: {product.name} - {product.price_text}",
                                columns=columns if columns else None,
                                catalog_type=catalog_type
                            ))
                        
                        logger.info(
                            f"gemini_pdf_page_analyzed",
                            extra={"page": page_num, "products": len(products)}
                        )
                    
                    logger.info(
                        "gemini_pdf_batch_completed",
                        extra={
                            "batch": batch_idx + 1,
                            "total_batches": total_batches,
                            "products_in_batch": sum(
                                len(r.get("products", [])) for r in batch_results
                            ),
                            "progress_percent": round(((batch_idx + 1) / total_batches) * 100, 1),
                            "total_products_so_far": len(all_products)
                        }
                    )
                    
                except Exception as e:
                    consecutive_failures += 1
                    error_msg = str(e).lower()
                    
                    logger.warning(
                        f"gemini_batch_failed",
                        extra={
                            "batch": batch_idx + 1, 
                            "page_range": f"{start_idx + 1}-{end_idx}",
                            "consecutive_failures": consecutive_failures,
                            "error": str(e)[:200]
                        }
                    )
                    
                    # Check for quota exhaustion
                    if "quota" in error_msg or "429" in error_msg or consecutive_failures >= max_consecutive_failures:
                        logger.warning(
                            "gemini_quota_exhausted_fallback",
                            extra={
                                "consecutive_failures": consecutive_failures,
                                "products_extracted_so_far": len(all_products),
                                "pages_processed": pages_processed,
                                "total_pages": len(images)
                            }
                        )
                        # Return what we have so far + fallback extraction for remaining pages
                        fallback_products = await self._fallback_extraction(content)
                        # Combine: keep Gemini products and add fallback products that aren't duplicates
                        if all_products:
                            logger.info(
                                "gemini_partial_success",
                                extra={
                                    "gemini_products": len(all_products),
                                    "fallback_products": len(fallback_products)
                                }
                            )
                            # Return Gemini products + fallback as backup
                            return all_products if len(all_products) > len(fallback_products) else fallback_products
                        return fallback_products
                    
                    continue
            
            if all_products:
                logger.info(
                    "gemini_pdf_extraction_complete",
                    extra={"total_products": len(all_products), "pages": len(images)}
                )
                self._log_extraction_complete(len(all_products))
                return all_products
            
            # If no products found with Gemini, try fallback
            logger.warning("Gemini found no products, trying fallback")
            return await self._fallback_extraction(content)
            
        except Exception as e:
            logger.error(f"Gemini PDF extraction failed: {e}", exc_info=True)
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
