"""
Master Table API Router.

Provides endpoints for the unified Master Table (Gestión Listados).
Supports dual view modes (Enterprise/Client) with editable fields.
"""
import logging
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc

from database.connection import get_db
from database.models import MasterProduct, PriceList
from api.dependencies import get_current_user_id
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/master-products", tags=["master-products"])


# Schemas
class MasterProductResponse(BaseModel):
    id: int
    index_number: int
    clean_code: str
    description: str
    brand: Optional[str]
    price_usd: Decimal
    review_status: str
    confidence_score: float
    source_list_id: int
    original_list_name: str
    margin_percentage: Optional[Decimal]
    final_price: Optional[Decimal]
    
    class Config:
        from_attributes = True


class MasterProductListResponse(BaseModel):
    products: List[MasterProductResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


class UpdateMarginRequest(BaseModel):
    margin_percentage: Decimal = Field(..., ge=-100, le=1000)


class UpdateFinalPriceRequest(BaseModel):
    final_price: Decimal = Field(..., gt=0)


class PriceStatsResponse(BaseModel):
    """Statistics for heatmap percentile calculation."""
    min_price: Decimal
    max_price: Decimal
    p25: Decimal  # 25th percentile
    p50: Decimal  # 50th percentile (median)
    p75: Decimal  # 75th percentile


# Endpoints
@router.get("", response_model=MasterProductListResponse)
async def get_master_products(
    view_mode: str = Query("enterprise", regex="^(enterprise|client)$"),
    sort_by: str = Query("alphabetical", regex="^(alphabetical|brand|description|price)$"),
    brand_filter: Optional[str] = None,
    review_status_filter: Optional[str] = Query(None, regex="^(pending|confirmed|rejected)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get master products with filters and pagination.
    
    Supports two view modes:
    - enterprise: Shows all columns including margin %
    - client: Shows final price instead of margin
    """
    # Base query - filter by user's lists
    query = db.query(MasterProduct).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(PriceList.user_id == user_id)
    
    # Apply filters
    if brand_filter:
        query = query.filter(
            func.lower(MasterProduct.brand).like(f"%{brand_filter.lower()}%")
        )
    
    if review_status_filter:
        query = query.filter(MasterProduct.review_status == review_status_filter)
    
    # Apply sorting
    if sort_by == "alphabetical":
        query = query.order_by(asc(MasterProduct.description))
    elif sort_by == "brand":
        query = query.order_by(asc(MasterProduct.brand), asc(MasterProduct.description))
    elif sort_by == "description":
        query = query.order_by(asc(MasterProduct.description))
    elif sort_by == "price":
        query = query.order_by(asc(MasterProduct.price_usd))
    
    # Get total count
    total = query.count()
    
    # Pagination
    offset = (page - 1) * limit
    products = query.offset(offset).limit(limit).all()
    
    return MasterProductListResponse(
        products=products,
        total=total,
        page=page,
        limit=limit,
        has_next=offset + limit < total,
        has_prev=page > 1
    )


@router.get("/stats", response_model=PriceStatsResponse)
async def get_price_stats(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Get price statistics for heatmap percentile calculation.
    
    Returns min, max, and percentiles (p25, p50, p75) for dynamic heatmap coloring.
    """
    # Get all prices for user's products
    prices_query = db.query(MasterProduct.price_usd).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(PriceList.user_id == user_id).order_by(MasterProduct.price_usd)
    
    prices = [p[0] for p in prices_query.all()]
    
    if not prices:
        return PriceStatsResponse(
            min_price=Decimal("0"),
            max_price=Decimal("0"),
            p25=Decimal("0"),
            p50=Decimal("0"),
            p75=Decimal("0")
        )
    
    # Calculate percentiles
    def percentile(data: List[Decimal], p: float) -> Decimal:
        k = (len(data) - 1) * p
        f = int(k)
        c = k - f
        if f + 1 < len(data):
            return data[f] * Decimal(1 - c) + data[f + 1] * Decimal(c)
        return data[f]
    
    return PriceStatsResponse(
        min_price=prices[0],
        max_price=prices[-1],
        p25=percentile(prices, 0.25),
        p50=percentile(prices, 0.50),
        p75=percentile(prices, 0.75)
    )


@router.patch("/{product_id}/margin")
async def update_margin(
    product_id: int,
    request: UpdateMarginRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update margin percentage (Enterprise View).
    
    Automatically recalculates final_price = price_usd * (1 + margin/100)
    """
    product = db.query(MasterProduct).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(
        MasterProduct.id == product_id,
        PriceList.user_id == user_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update margin
    product.margin_percentage = request.margin_percentage
    
    # Calculate final price
    margin_multiplier = 1 + (request.margin_percentage / 100)
    product.final_price = product.price_usd * margin_multiplier
    
    db.commit()
    db.refresh(product)
    
    logger.info(
        "margin_updated",
        extra={
            "product_id": product_id,
            "margin": float(request.margin_percentage),
            "final_price": float(product.final_price)
        }
    )
    
    return {"status": "success", "final_price": product.final_price}


@router.patch("/{product_id}/final-price")
async def update_final_price(
    product_id: int,
    request: UpdateFinalPriceRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update final price (Client View).
    
    Automatically recalculates margin % = ((final - base) / base) * 100
    """
    product = db.query(MasterProduct).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(
        MasterProduct.id == product_id,
        PriceList.user_id == user_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update final price
    product.final_price = request.final_price
    
    # Calculate margin percentage (inverse)
    if product.price_usd > 0:
        margin = ((request.final_price - product.price_usd) / product.price_usd) * 100
        product.margin_percentage = margin
    else:
        product.margin_percentage = Decimal("0")
    
    db.commit()
    db.refresh(product)
    
    logger.info(
        "final_price_updated",
        extra={
            "product_id": product_id,
            "final_price": float(request.final_price),
            "margin": float(product.margin_percentage)
        }
    )
    
    return {"status": "success", "margin_percentage": product.margin_percentage}


@router.patch("/{product_id}/review-status")
async def update_review_status(
    product_id: int,
    status: str = Query(..., regex="^(confirmed|rejected)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Update review status for a product.
    
    Used when user manually confirms or rejects a product with low confidence.
    """
    product = db.query(MasterProduct).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(
        MasterProduct.id == product_id,
        PriceList.user_id == user_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.review_status = status
    
    # If confirmed, update code registry
    if status == "confirmed":
        from services.etl_intelligent_service import ETLIntelligentService
        etl = ETLIntelligentService(db)
        await etl._update_code_registry(
            product.clean_code,
            product.description,
            product.brand
        )
    
    db.commit()
    
    logger.info(
        "review_status_updated",
        extra={
            "product_id": product_id,
            "status": status
        }
    )
    
    return {"status": "success"}


@router.get("/export")
async def export_master_products(
    format: str = Query("excel", regex="^(excel|pdf)$"),
    view_mode: str = Query("enterprise", regex="^(enterprise|client)$"),
    sort_by: str = Query("alphabetical", regex="^(alphabetical|brand|description|price)$"),
    brand_filter: Optional[str] = None,
    review_status_filter: Optional[str] = Query(None, regex="^(pending|confirmed|rejected)$"),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Export master products to Excel or PDF.
    
    Respects current filters and view mode:
    - enterprise: Includes margin % column
    - client: Includes final price column only
    
    Returns file download.
    """
    from fastapi.responses import StreamingResponse
    import io
    
    # Build query with filters (same as get_master_products)
    query = db.query(MasterProduct).join(
        Catalog, MasterProduct.source_list_id == PriceList.id
    ).filter(PriceList.user_id == user_id)
    
    if brand_filter:
        query = query.filter(
            func.lower(MasterProduct.brand).like(f"%{brand_filter.lower()}%")
        )
    
    if review_status_filter:
        query = query.filter(MasterProduct.review_status == review_status_filter)
    
    # Apply sorting
    if sort_by == "alphabetical":
        query = query.order_by(asc(MasterProduct.description))
    elif sort_by == "brand":
        query = query.order_by(asc(MasterProduct.brand), asc(MasterProduct.description))
    elif sort_by == "description":
        query = query.order_by(asc(MasterProduct.description))
    elif sort_by == "price":
        query = query.order_by(asc(MasterProduct.price_usd))
    
    products = query.all()
    
    if format == "excel":
        return await _export_to_excel(products, view_mode)
    else:
        return await _export_to_pdf(products, view_mode)


async def _export_to_excel(products: List[MasterProduct], view_mode: str):
    """Generate Excel export."""
    from fastapi.responses import StreamingResponse
    import io
    
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="openpyxl not installed. Run: pip install openpyxl"
        )
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Master Table"
    
    # Headers based on view mode
    if view_mode == "enterprise":
        headers = ["N°", "CÓDIGO O REFERENCIA", "DESCRIPCIÓN", "MARCA", "LISTA ORIGINAL", "USD", "%"]
    else:
        headers = ["N°", "CÓDIGO O REFERENCIA", "DESCRIPCIÓN", "MARCA", "USD PRECIO FINAL"]
    
    # Style header
    header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    # Data rows
    for row_idx, product in enumerate(products, 2):
        ws.cell(row=row_idx, column=1, value=product.index_number)
        ws.cell(row=row_idx, column=2, value=product.clean_code)
        ws.cell(row=row_idx, column=3, value=product.description)
        ws.cell(row=row_idx, column=4, value=product.brand or "")
        
        if view_mode == "enterprise":
            ws.cell(row=row_idx, column=5, value=product.original_list_name)
            ws.cell(row=row_idx, column=6, value=float(product.price_usd))
            margin = float(product.margin_percentage) if product.margin_percentage else 0
            ws.cell(row=row_idx, column=7, value=f"{margin:.1f}%")
        else:
            final = float(product.final_price) if product.final_price else float(product.price_usd)
            ws.cell(row=row_idx, column=5, value=final)
    
    # Adjust column widths
    for col in ws.columns:
        max_length = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 2, 50)
    
    # Save to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"master_table_{view_mode}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


async def _export_to_pdf(products: List[MasterProduct], view_mode: str):
    """Generate PDF export."""
    from fastapi.responses import StreamingResponse
    import io
    
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
    except ImportError:
        raise HTTPException(
            status_code=500, 
            detail="reportlab not installed. Run: pip install reportlab"
        )
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    styles = getSampleStyleSheet()
    
    # Title
    title = Paragraph(
        f"<b>Master Table - Vista {'Empresarial' if view_mode == 'enterprise' else 'Cliente'}</b>",
        styles['Title']
    )
    elements.append(title)
    
    # Headers
    if view_mode == "enterprise":
        headers = ["N°", "CÓDIGO", "DESCRIPCIÓN", "MARCA", "LISTA", "USD", "%"]
    else:
        headers = ["N°", "CÓDIGO", "DESCRIPCIÓN", "MARCA", "USD FINAL"]
    
    data = [headers]
    
    # Data rows
    for product in products[:500]:  # Limit for PDF
        if view_mode == "enterprise":
            margin = float(product.margin_percentage) if product.margin_percentage else 0
            row = [
                product.index_number,
                product.clean_code[:20],
                product.description[:40],
                (product.brand or "")[:15],
                product.original_list_name[:15],
                f"${float(product.price_usd):.2f}",
                f"{margin:.1f}%"
            ]
        else:
            final = float(product.final_price) if product.final_price else float(product.price_usd)
            row = [
                product.index_number,
                product.clean_code[:20],
                product.description[:50],
                (product.brand or "")[:15],
                f"${final:.2f}"
            ]
        data.append(row)
    
    # Create table
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    
    elements.append(table)
    doc.build(elements)
    
    buffer.seek(0)
    filename = f"master_table_{view_mode}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

