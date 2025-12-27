"""
Upload API router.

Handles file upload and catalog processing.
"""
import logging
import mimetypes
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Catalog, Product, PriceRange, ProcessingLog
from api.v1.schemas.schemas import UploadResponse
from api.dependencies import get_current_user_id
from services.extractors.pdf_extractor import PDFExtractor
from services.extractors.excel_parser import ExcelParser
from services.extractors.ocr_extractor import OCRExtractor
from services.extractors.gemini_extractor import GeminiExtractor  # Gemini Vision AI for images
from services.extractors.gemini_pdf_extractor import GeminiPDFExtractor  # Gemini Vision AI for PDFs
from services.classification_service import ClassificationService
from core.exceptions import FileProcessingError, CatalogTooLarge
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# Initialize extractors
gemini_pdf_extractor = GeminiPDFExtractor()  # Gemini Vision AI for PDFs (primary)
pdf_extractor = PDFExtractor()  # Traditional PDF extraction (fallback)
excel_parser = ExcelParser()
ocr_extractor = OCRExtractor()
gemini_extractor = GeminiExtractor()  # Gemini Vision AI for images

# Initialize classification service
classification_service = ClassificationService()


async def process_catalog_background(
    catalog_id: int,
    file_content: bytes,
    mime_type: str,
    user_id: int
):
    """
    Background task to process uploaded catalog.
    
    Extracts products and classifies them.
    """
    # Create a new database session for background processing
    db = next(get_db())
    try:
        catalog = db.get(Catalog, catalog_id)
        if not catalog:
            logger.error("catalog_not_found", extra={"catalog_id": catalog_id})
            return
        
        # Create processing log
        log = ProcessingLog(
            catalog_id=catalog_id,
            status="started"
        )
        db.add(log)
        db.commit()
        
        try:
            # Update catalog status
            catalog.status = "processing"
            db.commit()
            
            # Extract products
            log.status = "extracting"
            db.commit()
            
            extractor = None
            if gemini_pdf_extractor.supports(mime_type):  # Gemini Vision AI for PDFs (primary)
                extractor = gemini_pdf_extractor
            elif excel_parser.supports(mime_type):
                extractor = excel_parser
            elif gemini_extractor.supports(mime_type):  # Gemini Vision AI for images
                extractor = gemini_extractor
            elif ocr_extractor.supports(mime_type):  # OCR fallback
                extractor = ocr_extractor
            else:
                raise FileProcessingError(f"Unsupported file type: {mime_type}")
            
            raw_products = await extractor.extract(file_content)
            log.products_extracted = len(raw_products)
            db.commit()
            
            if len(raw_products) > settings.max_products_per_catalog:
                raise CatalogTooLarge(
                    f"Catalog has {len(raw_products)} products, max is {settings.max_products_per_catalog}"
                )
            
            # Parse prices and create Product objects
            products = []
            for raw_product in raw_products:
                # Simple price parsing (remove non-numeric except . and ,)
                price_str = ''.join(c for c in raw_product.price_text if c.isdigit() or c in '.,')
                price_str = price_str.replace(',', '.')
                
                try:
                    price = float(price_str) if price_str else None
                except ValueError:
                    price = None
                
                product = Product(
                    catalog_id=catalog_id,
                    name=raw_product.name,
                    price=price,
                    original_text=raw_product.raw_line,
                    catalog_type=raw_product.catalog_type,  # NEW: store catalog type
                    structured_data=raw_product.columns if raw_product.columns else None,  # NEW: store flexible columns
                    classification_method='pending',
                    confidence_score=0.0
                )
                products.append(product)
            
            db.add_all(products)
            db.commit()
            
            # Classify products
            log.status = "classifying"
            db.commit()
            
            # Get price ranges
            price_ranges = db.query(PriceRange).filter(
                PriceRange.user_id == user_id
            ).all()
            
            # Only classify if we have price-based products
            price_based_products = [p for p in products if p.price is not None]
            
            if price_ranges and price_based_products:
                # Classify products
                results = await classification_service.classify_products(
                    price_based_products,
                    price_ranges
                )
                
                # Update products with classification
                for product, result in zip(price_based_products, results):
                    product.price_range_id = result.price_range_id
                    product.classification_method = result.method
                    product.confidence_score = result.confidence
                
                log.products_classified = len([r for r in results if r.price_range_id])
                db.commit()
            else:
                # For non-price catalogs (e.g., automotive parts), mark as complete without classification
                logger.info(
                    "catalog_no_price_classification",
                    extra={
                        "catalog_id": catalog_id,
                        "catalog_type": products[0].catalog_type if products else "unknown",
                        "total_products": len(products),
                        "price_based_products": len(price_based_products)
                    }
                )
                log.products_classified = 0
            
            # Update catalog
            catalog.status = "completed"
            catalog.product_count = len(products)
            log.status = "completed"
            db.commit()
            
            logger.info(
                "catalog_processed",
                extra={
                    "catalog_id": catalog_id,
                    "products_extracted": len(products),
                    "products_classified": log.products_classified
                }
            )
            
        except Exception as e:
            logger.error(
                "catalog_processing_failed",
                extra={
                    "catalog_id": catalog_id,
                    "error": str(e)
                },
                exc_info=True
            )
            catalog.status = "failed"
            log.status = "failed"
            log.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/catalogs/upload", response_model=UploadResponse, status_code=202)
async def upload_catalog(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Upload a catalog file (PDF or Excel).
    
    Accepts PDF (.pdf) and Excel (.xlsx, .xls) files.
    Processing happens in the background.
    
    Returns 202 Accepted with catalog ID.
    """
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {settings.max_file_size_mb}MB"
        )
    
    # Detect MIME type from filename
    mime_type, _ = mimetypes.guess_type(file.filename)
    
    # If mimetypes can't detect, try by extension
    if not mime_type:
        if file.filename.lower().endswith('.pdf'):
            mime_type = 'application/pdf'
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            mime_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            mime_type = 'application/octet-stream'
    
    # Validate MIME type
    supported_types = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'image/jpeg',  # NEW: Image support
        'image/jpg',   # NEW: Image support
        'image/png',   # NEW: Image support
    ]
    
    if mime_type not in supported_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {mime_type}. Supported: PDF, Excel"
        )
    
    # Create catalog record
    catalog = Catalog(
        user_id=user_id,
        name=file.filename or "Untitled",
        source_file=file.filename,
        file_type=mime_type,
        file_size_bytes=len(content),
        status="pending"
    )
    
    db.add(catalog)
    db.commit()
    db.refresh(catalog)
    
    logger.info(
        "catalog_uploaded",
        extra={
            "catalog_id": catalog.id,
            "file_name": file.filename,
            "size_bytes": len(content),
            "mime_type": mime_type
        }
    )
    
    # Process in background
    background_tasks.add_task(
        process_catalog_background,
        catalog.id,
        content,
        mime_type,
        user_id
    )
    
    return UploadResponse(
        catalog_id=catalog.id,
        message="File uploaded successfully. Processing started.",
        status="processing"
    )
