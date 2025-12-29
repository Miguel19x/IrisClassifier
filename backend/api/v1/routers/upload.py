"""
Upload API router.

Handles file upload and list processing with ETL Intelligent.
"""
import logging
import mimetypes
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import PriceList, Product, PriceRange, ProcessingLog, MasterProduct
from api.v1.schemas.schemas import UploadResponse
from api.dependencies import get_current_user_id
from services.extractors.pdf_extractor import PDFExtractor
from services.extractors.excel_parser import ExcelParser
from services.extractors.ocr_extractor import OCRExtractor
from services.extractors.gemini_extractor import GeminiExtractor
from services.extractors.gemini_pdf_extractor import GeminiPDFExtractor
from services.classification_service import ClassificationService
from services.etl_intelligent_service import ETLIntelligentService
from core.exceptions import FileProcessingError, CatalogTooLarge
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# Initialize extractors
gemini_pdf_extractor = GeminiPDFExtractor()
pdf_extractor = PDFExtractor()
excel_parser = ExcelParser()
ocr_extractor = OCRExtractor()
gemini_extractor = GeminiExtractor()

# Initialize classification service
classification_service = ClassificationService()


async def process_list_background(
    list_id: int,
    file_content: bytes,
    mime_type: str,
    user_id: int
):
    """
    Background task to process uploaded list with ETL Intelligent.
    
    Extracts products, transforms with ETL, and saves to master_products.
    """
    # Create a new database session for background processing
    db = next(get_db())
    try:
        list_record = db.get(PriceList, list_id)
        if not list_record:
            logger.error("list_not_found", extra={"list_id": list_id})
            return
        
        # Create processing log
        log = ProcessingLog(
            list_id=list_id,
            status="started"
        )
        db.add(log)
        db.commit()
        
        try:
            # Update list status
            list_record.status = "processing"
            db.commit()
            
            # Phase 1: Extract products
            log.status = "extracting"
            log.progress_message = "Extrayendo productos del archivo..."
            db.commit()
            
            # Extractor selection priority
            extractor = None
            if excel_parser.supports(mime_type):
                extractor = excel_parser
            elif gemini_pdf_extractor.supports(mime_type):
                extractor = gemini_pdf_extractor
            elif gemini_extractor.supports(mime_type):
                extractor = gemini_extractor
            elif ocr_extractor.supports(mime_type):
                extractor = ocr_extractor
            else:
                raise FileProcessingError(f"Unsupported file type: {mime_type}")
            
            raw_products = await extractor.extract(file_content)
            log.products_extracted = len(raw_products)
            log.progress_message = f"Extraídos {len(raw_products)} productos, procesando ETL..."
            db.commit()
            
            if len(raw_products) > settings.max_products_per_catalog:
                raise CatalogTooLarge(
                    f"List has {len(raw_products)} products, max is {settings.max_products_per_catalog}"
                )
            
            # Phase 2: ETL Intelligent Processing
            log.status = "classifying"
            log.progress_message = "Aplicando ETL Inteligente con validación histórica..."
            db.commit()
            
            etl_service = ETLIntelligentService(db)
            master_products = await etl_service.process_file(
                raw_products=raw_products,
                list_id=list_id,
                list_name=list_record.name
            )
            
            # Save master products
            db.add_all(master_products)
            db.commit()
            
            # Count products needing review
            pending_review = sum(1 for p in master_products if p.review_status == "pending")
            confirmed = sum(1 for p in master_products if p.review_status == "confirmed")
            
            log.products_classified = confirmed
            log.progress_message = f"ETL completado: {confirmed} confirmados, {pending_review} pendientes de revisión"
            
            # Also save to legacy products table for backward compatibility
            for idx, raw_product in enumerate(raw_products, start=1):
                # Simple price parsing
                price_str = ''.join(c for c in raw_product.price_text if c.isdigit() or c in '.,')
                price_str = price_str.replace(',', '.')
                
                try:
                    price = float(price_str) if price_str else None
                except ValueError:
                    price = None
                
                columns = raw_product.columns or {}
                code = columns.get('code', '')
                brand = columns.get('brand', '')
                
                product = Product(
                    list_id=list_id,
                    row_index=idx,  # Sequential ordering
                    code=code if code else None,
                    name=raw_product.name,
                    brand=brand if brand else None,
                    price=price,
                    original_text=raw_product.raw_line,
                    list_type=raw_product.catalog_type,
                    structured_data=raw_product.columns if raw_product.columns else None,
                    classification_method='ai',
                    confidence_score=1.0
                )
                db.add(product)
            
            db.commit()
            
            # Optional: Price range classification for legacy support
            price_ranges = db.query(PriceRange).filter(
                PriceRange.user_id == user_id
            ).all()
            
            products = db.query(Product).filter(Product.list_id == list_id).all()
            price_based_products = [p for p in products if p.price is not None]
            
            if price_ranges and price_based_products:
                results = await classification_service.classify_products(
                    price_based_products,
                    price_ranges
                )
                
                for product, result in zip(price_based_products, results):
                    product.price_range_id = result.price_range_id
                    product.classification_method = result.method
                    product.confidence_score = result.confidence
                
                db.commit()
            
            # Update list record
            list_record.status = "completed"
            list_record.product_count = len(master_products)
            log.status = "completed"
            log.progress_message = f"Procesamiento completado: {len(master_products)} productos en Master Table"
            db.commit()
            
            logger.info(
                "list_processed_with_etl",
                extra={
                    "list_id": list_id,
                    "products_extracted": len(raw_products),
                    "master_products": len(master_products),
                    "pending_review": pending_review
                }
            )
            
        except Exception as e:
            logger.error(
                "list_processing_failed",
                extra={
                    "list_id": list_id,
                    "error": str(e)
                },
                exc_info=True
            )
            list_record.status = "failed"
            log.status = "failed"
            log.error_message = str(e)
            db.commit()
    finally:
        db.close()


# New endpoint: /lists/upload
@router.post("/lists/upload", response_model=UploadResponse, status_code=202)
async def upload_list(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Upload a price list file (PDF or Excel).
    
    Accepts PDF (.pdf) and Excel (.xlsx, .xls) files.
    Processing happens in the background with ETL Intelligent.
    
    Returns 202 Accepted with list ID.
    """
    content = await file.read()
    
    # Validate file size
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {settings.max_file_size_mb}MB"
        )
    
    # Detect MIME type
    mime_type, _ = mimetypes.guess_type(file.filename)
    
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
        'image/jpeg',
        'image/jpg',
        'image/png',
    ]
    
    if mime_type not in supported_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {mime_type}. Supported: PDF, Excel, Images"
        )
    
    # Create list record (using PriceList model for now, can rename later)
    list_record = PriceList(
        user_id=user_id,
        name=file.filename or "Sin nombre",
        source_file=file.filename,
        file_type=mime_type,
        file_size_bytes=len(content),
        status="pending"
    )
    
    db.add(list_record)
    db.commit()
    db.refresh(list_record)
    
    logger.info(
        "list_uploaded",
        extra={
            "list_id": list_record.id,
            "file_name": file.filename,
            "size_bytes": len(content),
            "mime_type": mime_type
        }
    )
    
    # Process in background with ETL
    background_tasks.add_task(
        process_list_background,
        list_record.id,
        content,
        mime_type,
        user_id
    )
    
    return UploadResponse(
        list_id=list_record.id,
        message="Lista subida exitosamente. Procesamiento ETL iniciado.",
        status="processing"
    )


# Legacy endpoint: /catalogs/upload (backward compatibility)
@router.post("/catalogs/upload", response_model=UploadResponse, status_code=202)
async def upload_catalog(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    DEPRECATED: Use /lists/upload instead.
    
    This endpoint is kept for backward compatibility.
    """
    return await upload_list(background_tasks, file, user_id, db)
