"""
Export API router.

Handles catalog export to various formats.
"""
import logging
import io
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
import pandas as pd

from database.connection import get_db
from database.models import PriceList, Product, PriceRange
from core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/catalogs/{catalog_id}/export")
def export_catalog(
    catalog_id: int,
    format: Literal["csv", "excel", "json"] = "excel",
    db: Session = Depends(get_db)
):
    """
    Export catalog products to various formats.
    
    Supports CSV, Excel (XLSX), and JSON formats.
    Returns a downloadable file.
    """
    # Get catalog
    catalog = db.get(PriceList, catalog_id)
    if not catalog:
        raise NotFoundError("Catalog", catalog_id)
    
    # Get products
    query = select(Product).where(Product.catalog_id == catalog_id)
    products = db.execute(query).scalars().all()
    
    if not products:
        raise HTTPException(status_code=404, detail="No products found in catalog")
    
    # Prepare data
    data = []
    for product in products:
        price_range_name = None
        if product.price_range_id:
            price_range = db.get(PriceRange, product.price_range_id)
            if price_range:
                price_range_name = price_range.name
        
        data.append({
            "ID": product.id,
            "Name": product.name,
            "Price": float(product.price) if product.price else None,
            "Currency": product.currency,
            "Price Range": price_range_name,
            "Classification Method": product.classification_method,
            "Confidence": round(product.confidence_score * 100, 2),
            "Created At": product.created_at.isoformat(),
        })
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Generate file based on format
    if format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=catalog_{catalog_id}.csv"
            }
        )
    
    elif format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Products')
            
            # Auto-adjust column widths
            worksheet = writer.sheets['Products']
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).apply(len).max(),
                    len(col)
                ) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)
        
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=catalog_{catalog_id}.xlsx"
            }
        )
    
    else:  # json
        return {
            "catalog_id": catalog_id,
            "catalog_name": PriceList.name,
            "total_products": len(data),
            "exported_at": pd.Timestamp.now().isoformat(),
            "products": data
        }
