"""
Excel parser using pandas.

Extracts products and prices from Excel files (.xlsx, .xls).
Supports flexible catalog schemas with smart header detection.

Uses shared ColumnExtractor for column mapping and validation.
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
from .column_extractor import (
    get_column_extractor,
    ColumnExtractor,
    HEADER_KEYWORDS,
    SKIP_PATTERNS,
    PRICE_PLACEHOLDERS
)
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)


class ExcelParser(BaseExtractor):
    """
    Extracts products and prices from Excel files.
    
    Handles:
    - Multiple sheets
    - Header row detection (finds actual headers, not first row)
    - Metadata/category row skipping
    - Column auto-detection for código, descripción, marca, precio
    - Formula evaluation
    
    Uses shared ColumnExtractor for consistent column detection.
    """
    
    def __init__(self):
        """Initialize Excel parser with shared ColumnExtractor."""
        super().__init__()
        self.column_extractor = get_column_extractor()
    
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
        
        # Log all column names pandas found (for debugging merged cells)
        logger.info(
            "excel_raw_columns",
            extra={
                "sheet": sheet_name,
                "columns": list(df.columns),
                "column_count": len(df.columns)
            }
        )
        
        # Map columns to their purpose (header-based first)
        header_map = self._map_columns(df.columns)
        
        logger.info(
            "excel_header_map",
            extra={"header_based": header_map}
        )
        
        # Enhance with content-based detection for misaligned headers
        column_map = self._map_columns_by_content(df, header_map)
        
        logger.info(
            "excel_columns_mapped",
            extra={
                "sheet": sheet_name,
                "reference_col": column_map.get('reference'),
                "internal_code_col": column_map.get('internal_code'),
                "name_col": column_map.get('name'),
                "brand_col": column_map.get('brand'),
                "price_col": column_map.get('price'),
                "detection_method": "header+content"
            }
        )
        
        # We need at least a name/description column
        name_col = column_map.get('name')
        if name_col is None:
            # Fallback: find the text column with LONGEST average content
            # This ensures we get the description column, not a short code column
            best_col = None
            best_avg_len = 0
            
            for col in df.columns:
                # Skip columns already mapped to other purposes
                if col in column_map.values():
                    continue
                    
                if df[col].dtype == object:
                    # Calculate average string length for this column
                    sample = df[col].head(20).dropna()
                    if len(sample) > 0:
                        avg_len = sample.astype(str).str.len().mean()
                        # Description columns typically have longer text (>30 chars avg)
                        if avg_len > best_avg_len:
                            best_avg_len = avg_len
                            best_col = col
            
            # Only use if average length suggests descriptions, not codes
            if best_col and best_avg_len > 15:
                name_col = best_col
                logger.info(f"Fallback name column: {best_col} (avg length: {best_avg_len:.1f})")

        
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
            
            # Extract code - PRIORITIZE REFERENCE over internal_code
            # 'reference' column (REFERENCIA) = actual product code
            # 'internal_code' column (CODIGO) = distributor's internal code
            ref_col = column_map.get('reference')
            internal_code_col = column_map.get('internal_code')
            
            # Get reference value (actual product code)
            ref_value = ""
            if ref_col and pd.notna(row.get(ref_col)):
                ref_value = str(row[ref_col]).strip()
                if ref_value.lower() in ['nan', 'none']:
                    ref_value = ""
            
            # Get internal code value (distributor code)
            internal_code_value = ""
            if internal_code_col and pd.notna(row.get(internal_code_col)):
                internal_code_value = str(row[internal_code_col]).strip()
                if internal_code_value.lower() in ['nan', 'none']:
                    internal_code_value = ""
            
            # Use REFERENCE as primary code, fallback to internal_code if no reference
            code_value = ref_value if ref_value else internal_code_value
            
            # Extract brand
            brand_col = column_map.get('brand')
            brand_value = str(row[brand_col]).strip() if brand_col and pd.notna(row.get(brand_col)) else ""
            if brand_value.lower() in ['nan', 'none']:
                brand_value = ""
            
            # Try to separate brand from code if brand not found
            # Examples: "28-124 HARFON" -> code="28-124", brand="HARFON"
            if code_value and not brand_value:
                separated_code, separated_brand = self.column_extractor.separate_brand_from_code(code_value)
                if separated_brand:
                    code_value = separated_code
                    brand_value = separated_brand
            
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
            
            # Check if price is just a placeholder (dash, empty, etc.)
            price_is_placeholder = (
                not price_text or 
                price_text.strip() in ['-', '--', '---', 'n/a', 'N/A', '$', '-$', '0', '0.00', '0,00']
            )
            
            # SUBTITLE DETECTION:
            # A row with description but missing code, brand, AND has no real price is a subtitle/category
            # Skip these rows as they are not products
            has_code = bool(code_value)
            has_brand = bool(brand_value)
            has_real_price = not price_is_placeholder
            
            if not has_code and not has_brand and not has_real_price:
                logger.info(
                    "excel_subtitle_detected",
                    extra={
                        "subtitle": name_value,
                        "row_index": idx,
                        "sheet": sheet_name,
                        "price_text": price_text,
                    }
                )
                continue  # Skip subtitle/category rows
            
            # Build columns dict for structured data
            columns = {
                'code': code_value,
                'internal_code': internal_code_value,  # Distributor's internal code
                'name': name_value,
                'brand': brand_value,
                'price': price_text,
            }
            
            # Add any other columns
            used_cols = [name_col, ref_col, internal_code_col, brand_col, price_col]
            for col in df.columns:
                if col not in used_cols:
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
            col_str = str(col).strip()
            col_lower = col_str.lower()
            
            # SKIP 'Unnamed' columns - these are artifacts of merged cells
            if col_lower.startswith('unnamed'):
                continue
            
            # Check each category of keywords
            for purpose, keywords in HEADER_KEYWORDS.items():
                if purpose in column_map:
                    continue  # Already found this column type
                
                # Use word-boundary matching to avoid 'name' matching 'unnamed'
                for kw in keywords:
                    # Exact match or keyword at word boundary
                    if col_lower == kw or col_lower.startswith(kw + ' ') or col_lower.endswith(' ' + kw) or (' ' + kw + ' ') in col_lower:
                        column_map[purpose] = col
                        break
                    # Also check if the column starts with the keyword (e.g., "DESCRIPCION PRODUCTO")
                    if col_lower.startswith(kw):
                        column_map[purpose] = col
                        break
                else:
                    continue
                break
        
        return column_map
    
    def _map_columns_by_content(
        self, 
        df: 'pd.DataFrame', 
        header_map: Dict[str, str]
    ) -> Dict[str, str]:
        """
        Enhanced column mapping using content analysis.
        
        When headers are misaligned (merged cells, different positions),
        this method analyzes actual data content to determine column purposes.
        
        Also VALIDATES header-mapped columns to ensure they contain expected data types.
        If a column mapped by header doesn't match expected content, it's remapped.
        
        Patterns detected:
        - price: Numeric values with decimals/currency symbols
        - code: Alphanumeric patterns like "B11-3701110BB", "ALT01037"
        - brand: Short uppercase strings (2-20 chars)
        - name: Longer descriptive text
        """
        # Sample first 20 data rows for analysis
        sample_df = df.head(20)
        
        # Patterns for content detection
        price_pattern = re.compile(r'^[\$€]?\s*[\d\.,]+\s*[\$€]?$')
        code_pattern = re.compile(r'^[A-Z0-9][\w\-]{2,30}$', re.IGNORECASE)
        
        # STEP 1: Validate header-based mappings
        validated_map = {}
        for purpose, col in header_map.items():
            is_valid = self._validate_column_content(
                sample_df, col, purpose, price_pattern, code_pattern
            )
            if is_valid:
                validated_map[purpose] = col
            else:
                logger.warning(
                    f"Column '{col}' mapped as '{purpose}' by header but content doesn't match - removing mapping"
                )
        
        # STEP 2: Content-based detection for unmapped columns
        column_map = validated_map.copy()
        column_scores = {}
        
        for col in df.columns:
            if col in column_map.values():
                continue  # Already mapped and validated
            
            scores = {
                'price': 0,
                'reference': 0,
                'internal_code': 0,
                'brand': 0,
                'name': 0
            }
            
            for val in sample_df[col].dropna():
                val_str = str(val).strip()
                if not val_str or val_str.lower() in ['nan', 'none']:
                    continue
                
                # Price detection: numbers with decimal, $ symbol
                if price_pattern.match(val_str.replace(',', '.').replace(' ', '')):
                    scores['price'] += 2
                
                # Code detection: alphanumeric with dashes
                elif code_pattern.match(val_str):
                    # Longer codes with letters+numbers = reference
                    if len(val_str) > 5 and re.search(r'[A-Z].*\d|\d.*[A-Z]', val_str.upper()):
                        scores['reference'] += 1
                    # Short codes often internal
                    elif len(val_str) <= 10:
                        scores['internal_code'] += 1
                
                # Brand detection: short uppercase words
                elif len(val_str) <= 20 and val_str.isupper() and val_str.isalpha():
                    scores['brand'] += 1
                
                # Name detection: longer text
                elif len(val_str) > 20:
                    scores['name'] += 1
            
            column_scores[col] = scores
        
        # Assign columns based on highest scores (if not already mapped)
        for purpose in ['price', 'name', 'reference', 'internal_code', 'brand']:
            if purpose in column_map:
                continue
            
            best_col = None
            best_score = 0
            
            for col, scores in column_scores.items():
                if col in column_map.values():
                    continue
                if scores[purpose] > best_score:
                    best_score = scores[purpose]
                    best_col = col
            
            # Only assign if we have reasonable confidence
            if best_col and best_score >= 3:
                column_map[purpose] = best_col
                logger.debug(
                    f"Content-based column detection: {purpose} -> {best_col} (score: {best_score})"
                )
        
        return column_map
    
    def _should_skip_row(self, text: str) -> bool:
        """Check if a row should be skipped (metadata, category, etc.)."""
        text_lower = text.lower().strip()
        
        for pattern in SKIP_PATTERNS:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return True
        
        return False
    
    def _validate_column_content(
        self,
        df: 'pd.DataFrame',
        col_name: str,
        purpose: str,
        price_pattern: re.Pattern,
        code_pattern: re.Pattern
    ) -> bool:
        """
        Validate if a column's content matches its expected purpose.
        Returns True if the content looks valid for the mapped purpose.
        """
        if col_name not in df.columns:
            return False
            
        values = df[col_name].dropna().astype(str).tolist()
        if not values:
            return False # Empty column is not valid for required fields
            
        valid_count = 0
        total_count = len(values)
        
        for val in values:
            val = val.strip()
            if not val or val.lower() in ['nan', 'none']:
                total_count -= 1
                continue
                
            if purpose == 'price':
                # clean price
                val_clean = val.replace(',', '.').replace(' ', '').replace('$', '').replace('€', '')
                try:
                    float(val_clean)
                    valid_count += 1
                except ValueError:
                    pass
                    
            elif purpose in ['reference', 'internal_code']:
                if code_pattern.match(val):
                    # disqualifiers for codes
                    if len(val) > 40 or ' ' in val: # Codes usually don't have spaces (except some brands)
                         # Simple check: if it looks like a description (multiple words), it's not a code
                         if len(val.split()) > 2:
                             continue
                    valid_count += 1
                    
            elif purpose == 'brand':
                if len(val) <= 20 and val.isupper():
                    valid_count += 1
                    
            elif purpose == 'name':
                # Names are loose, but shouldn't be just numbers
                if len(val) > 3 and not val.replace('.','').isdigit():
                    valid_count += 1
        
        if total_count == 0:
            return False
            
        # Threshold: at least 40% of rows must match the expected pattern
        # This is lenient because of potential dirty data or subtitle rows
        return (valid_count / total_count) >= 0.4
