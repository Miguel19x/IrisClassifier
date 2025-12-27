"""
Excel parser using pandas.

Extracts products and prices from Excel files (.xlsx, .xls).
Now supports flexible catalog schemas.
"""
import io
import logging
from typing import List

try:
    import pandas as pd
except ImportError:
    pd = None

from .base import BaseExtractor, RawProduct
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)


class ExcelParser(BaseExtractor):
    """
    Extracts products and prices from Excel files.
    
    Handles:
    - Multiple sheets
    - Formula evaluation
    - Column auto-detection
    - Data type inference
    - Flexible catalog schemas (automotive parts, price lists, etc.)
    """
    
    def supports(self, mime_type: str) -> bool:
        """Check if this extractor supports Excel files."""
        return mime_type in [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
            'application/vnd.ms-excel',  # .xls
        ]
    
    async def extract(self, content: bytes) -> List[RawProduct]:
        """
        Extract products from Excel content.
        
        Args:
            content: Excel file bytes
            
        Returns:
            List[RawProduct]: Extracted products
            
        Raises:
            FileProcessingError: If Excel is corrupted
        """
        if pd is None:
            raise FileProcessingError("pandas not installed")
        
        from services.catalog_schema_detector import CatalogSchemaDetector
        
        self._log_extraction_start(len(content))
        products: List[RawProduct] = []
        
        try:
            # Read all sheets
            excel_file = pd.ExcelFile(io.BytesIO(content))
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                # Detect schema
                detector = CatalogSchemaDetector()
                headers = df.columns.tolist()
                sample_rows = df.head(5).values.tolist()
                schema = detector.detect(headers, sample_rows)
                
                logger.info(
                    "excel_schema_detected",
                    extra={
                        "sheet": sheet_name,
                        "schema_type": schema.schema_type,
                        "confidence": schema.confidence
                    }
                )
                
                # Extract based on schema type
                if schema.schema_type == "automotive_parts":
                    products.extend(self._extract_automotive_parts(df, schema))
                else:
                    products.extend(self._extract_price_list(df, schema))
                        
        except Exception as e:
            logger.error(
                "excel_extraction_failed",
                extra={
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                },
                exc_info=True
            )
            raise FileProcessingError(
                message=f"Failed to process Excel: {str(e)}"
            )
        
        self._log_extraction_complete(len(products))
        return products
    
    def _extract_automotive_parts(self, df, schema) -> List[RawProduct]:
        """Extract automotive parts from dataframe."""
        products = []
        
        for _, row in df.iterrows():
            columns = {}
            name_parts = []
            
            for col_name in df.columns:
                value = str(row[col_name]).strip()
                
                # Skip NaN and empty values
                if value.lower() in ['nan', 'none', '']:
                    continue
                
                columns[col_name] = value
                
                # Build name from key columns
                if schema.key_column and col_name == schema.key_column:
                    name_parts.insert(0, value)
                elif any(kw in str(col_name).lower() for kw in ['año', 'year', 'motor', 'engine']):
                    name_parts.append(value)
            
            if columns:
                name = " | ".join(name_parts) if name_parts else list(columns.values())[0]
                
                products.append(RawProduct(
                    name=name,
                    price_text="",
                    raw_line=str(row.to_dict()),
                    columns=columns,
                    catalog_type="automotive_parts"
                ))
        
        return products
    
    def _extract_price_list(self, df, schema) -> List[RawProduct]:
        """Extract price list from dataframe."""
        products = []
        
        # Detect name and price columns
        name_col, price_col = self._detect_columns(df.columns)
        
        if name_col is None or price_col is None:
            logger.warning("excel_columns_not_detected")
            return products
        
        for _, row in df.iterrows():
            name = str(row[name_col]).strip()
            price_text = str(row[price_col]).strip()
            
            # Skip empty rows or headers
            if name and price_text and name.lower() not in ['nan', 'none', '']:
                # Store all columns
                columns = {
                    col: str(row[col]).strip()
                    for col in df.columns
                    if str(row[col]).strip().lower() not in ['nan', 'none', '']
                }
                
                products.append(RawProduct(
                    name=name,
                    price_text=price_text,
                    raw_line=f"{name} | {price_text}",
                    columns=columns,
                    catalog_type="price_list"
                ))
        
        return products
    
    def _detect_columns(self, columns) -> tuple:
        """Detect name and price columns from dataframe columns."""
        name_col = None
        price_col = None
        
        for col in columns:
            col_lower = str(col).lower()
            
            if name_col is None and any(
                word in col_lower 
                for word in ['nombre', 'producto', 'item', 'name', 'descripcion', 'description']
            ):
                name_col = col
            
            if price_col is None and any(
                word in col_lower 
                for word in ['precio', 'price', 'valor', 'costo', 'cost', 'amount']
            ):
                price_col = col
        
        # If not found, use first two columns as fallback
        if name_col is None and len(columns) > 0:
            name_col = columns[0]
        if price_col is None and len(columns) > 1:
            price_col = columns[1]
        
        return name_col, price_col
