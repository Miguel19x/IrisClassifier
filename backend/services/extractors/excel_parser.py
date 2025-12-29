"""
Excel parser using pandas.

Extracts products and prices from Excel files (.xlsx, .xls).
Supports flexible catalog schemas with smart header detection.
"""
import io
import logging
import re
from typing import List, Optional, Dict, Tuple

try:
    import pandas as pd
except ImportError:
    pd = None

from .base import BaseExtractor, RawProduct
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)


# Known header keywords for column detection
HEADER_KEYWORDS = {
    'code': ['codigo', 'código', 'code', 'ref', 'referencia', 'sku', 'part', 'parte'],
    'name': ['descripcion', 'descripción', 'nombre', 'producto', 'item', 'name', 'description'],
    'brand': ['marca', 'brand', 'fabricante', 'manufacturer'],
    'price': ['precio', 'price', 'usd', 'eur', 'bs', 'valor', 'costo', 'cost', 'amount', 'pvp'],
}

# Rows to skip (metadata, titles, categories)
SKIP_PATTERNS = [
    r'^lista\s+de\s+precios?$',
    r'^a[ñn]o\s+\d{4}$',
    r'^email:?\s*',
    r'^\d{4}$',  # Just a year
    r'^rif\s*[j-]\d+',
    r'^fua\d+',
    r'^alternadores?\s*auto$',
    r'^alternadores?$',
    r'^categoria',
    r'^\s*$',
]


class ExcelParser(BaseExtractor):
    """
    Extracts products and prices from Excel files.
    
    Handles:
    - Multiple sheets
    - Header row detection (finds actual headers, not first row)
    - Metadata/category row skipping
    - Column auto-detection for código, descripción, marca, precio
    - Formula evaluation
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
        
        self._log_extraction_start(len(content))
        products: List[RawProduct] = []
        
        try:
            # Read all sheets without header (header=None to read raw data)
            excel_file = pd.ExcelFile(io.BytesIO(content))
            
            for sheet_name in excel_file.sheet_names:
                # Read without assuming first row is header
                df_raw = pd.read_excel(excel_file, sheet_name=sheet_name, header=None)
                
                # Find the actual header row
                header_row_idx = self._find_header_row(df_raw)
                
                if header_row_idx is None:
                    logger.warning(
                        "excel_no_header_found",
                        extra={"sheet": sheet_name}
                    )
                    # Try with first row as header
                    header_row_idx = 0
                
                logger.info(
                    "excel_header_detected",
                    extra={
                        "sheet": sheet_name,
                        "header_row": header_row_idx
                    }
                )
                
                # Read again with correct header
                df = pd.read_excel(
                    excel_file, 
                    sheet_name=sheet_name, 
                    header=header_row_idx
                )
                
                # Extract products from this sheet
                sheet_products = self._extract_products(df, sheet_name)
                products.extend(sheet_products)
                        
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
    
    def _find_header_row(self, df: 'pd.DataFrame') -> Optional[int]:
        """
        Find the row that contains the actual column headers.
        
        Looks for rows containing keywords like CODIGO, DESCRIPCION, MARCA, USD.
        """
        all_keywords = []
        for kw_list in HEADER_KEYWORDS.values():
            all_keywords.extend(kw_list)
        
        for idx, row in df.iterrows():
            row_values = [str(v).lower().strip() for v in row.values if pd.notna(v)]
            row_text = ' '.join(row_values)
            
            # Count how many header keywords match
            matches = sum(1 for kw in all_keywords if kw in row_text)
            
            # Need at least 2 matches (e.g., DESCRIPCION and USD)
            if matches >= 2:
                return idx
        
        return None
    
    def _extract_products(self, df: 'pd.DataFrame', sheet_name: str) -> List[RawProduct]:
        """Extract products from a dataframe with detected columns."""
        products = []
        
        # Map columns to their purpose
        column_map = self._map_columns(df.columns)
        
        logger.info(
            "excel_columns_mapped",
            extra={
                "sheet": sheet_name,
                "code_col": column_map.get('code'),
                "name_col": column_map.get('name'),
                "brand_col": column_map.get('brand'),
                "price_col": column_map.get('price'),
            }
        )
        
        # We need at least a name/description column
        name_col = column_map.get('name')
        if name_col is None:
            # Fallback: use first text-like column
            for col in df.columns:
                if df[col].dtype == object:
                    name_col = col
                    break
        
        if name_col is None:
            logger.warning("excel_no_name_column")
            return products
        
        for idx, row in df.iterrows():
            # Get values
            name_value = str(row[name_col]).strip() if name_col and pd.notna(row[name_col]) else ""
            
            # Skip if empty or looks like a header/category
            if not name_value or name_value.lower() in ['nan', 'none', '']:
                continue
            
            if self._should_skip_row(name_value):
                continue
            
            # Extract code
            code_col = column_map.get('code')
            code_value = str(row[code_col]).strip() if code_col and pd.notna(row.get(code_col)) else ""
            if code_value.lower() in ['nan', 'none']:
                code_value = ""
            
            # Extract brand
            brand_col = column_map.get('brand')
            brand_value = str(row[brand_col]).strip() if brand_col and pd.notna(row.get(brand_col)) else ""
            if brand_value.lower() in ['nan', 'none']:
                brand_value = ""
            
            # Extract price
            price_col = column_map.get('price')
            price_text = ""
            if price_col and pd.notna(row.get(price_col)):
                raw_price = row[price_col]
                # Handle numeric values directly
                if isinstance(raw_price, (int, float)):
                    price_text = str(raw_price)
                else:
                    price_text = str(raw_price).strip()
            
            if price_text.lower() in ['nan', 'none']:
                price_text = ""
            
            # SUBTITLE DETECTION:
            # A row with description but missing code, brand, AND price is a subtitle/category
            # Skip these rows as they are not products
            has_code = bool(code_value)
            has_brand = bool(brand_value)
            has_price = bool(price_text)
            
            if not has_code and not has_brand and not has_price:
                logger.debug(
                    "excel_subtitle_detected",
                    extra={
                        "subtitle": name_value,
                        "row_index": idx,
                        "sheet": sheet_name,
                    }
                )
                continue  # Skip subtitle/category rows
            
            # Build columns dict for structured data
            columns = {
                'code': code_value,
                'name': name_value,
                'brand': brand_value,
                'price': price_text,
            }
            
            # Add any other columns
            for col in df.columns:
                if col not in [name_col, code_col, brand_col, price_col]:
                    val = row.get(col)
                    if pd.notna(val):
                        col_str = str(val).strip()
                        if col_str.lower() not in ['nan', 'none', '']:
                            columns[str(col)] = col_str
            
            products.append(RawProduct(
                name=name_value,
                price_text=price_text,
                raw_line=f"{code_value} | {name_value} | {brand_value} | {price_text}",
                columns=columns,
                catalog_type="price_list"
            ))
        
        return products
    
    def _map_columns(self, columns) -> Dict[str, str]:
        """Map dataframe columns to their semantic purpose."""
        column_map = {}
        
        for col in columns:
            col_lower = str(col).lower().strip()
            
            # Check each category of keywords
            for purpose, keywords in HEADER_KEYWORDS.items():
                if purpose in column_map:
                    continue  # Already found this column type
                
                if any(kw in col_lower for kw in keywords):
                    column_map[purpose] = col
                    break
        
        return column_map
    
    def _should_skip_row(self, text: str) -> bool:
        """Check if a row should be skipped (metadata, category, etc.)."""
        text_lower = text.lower().strip()
        
        for pattern in SKIP_PATTERNS:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return True
        
        return False
