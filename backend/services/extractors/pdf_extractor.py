"""
PDF extractor using pdfplumber.

Extracts products and prices from PDF files with support for
tables and text-based extraction. Now supports flexible catalog schemas.
"""
import io
import re
import logging
from typing import List, Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from .base import BaseExtractor, RawProduct
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)

# Regex patterns for price detection
PRICE_PATTERNS = [
    r'\$[\d,]+\.?\d*',           # $1,234.56
    r'[\d.]+,\d{2}\s*€',         # 1.234,56€
    r'USD\s*[\d,]+\.?\d*',       # USD 100.00
    r'[\d,]+\.\d{2}',            # 1,234.56
    r'\d+\.\d{2}',               # 10.99
]


class PDFExtractor(BaseExtractor):
    """
    Extracts products and prices from PDF files.
    
    Handles:
    - Password-protected PDFs (error)
    - PDFs without tables (text extraction)
    - Multi-page PDFs
    - Malformed tables
    - Flexible catalog schemas (automotive parts, price lists, etc.)
    """
    
    def supports(self, mime_type: str) -> bool:
        """Check if this extractor supports PDF files."""
        return mime_type == 'application/pdf'
    
    async def extract(self, content: bytes) -> List[RawProduct]:
        """
        Extract products from PDF content.
        
        Args:
            content: PDF file bytes
            
        Returns:
            List[RawProduct]: Extracted products
            
        Raises:
            FileProcessingError: If PDF is corrupted or protected
        """
        if pdfplumber is None:
            raise FileProcessingError("pdfplumber not installed")
        
        self._log_extraction_start(len(content))
        products: List[RawProduct] = []
        
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                if len(pdf.pages) == 0:
                    logger.warning("pdf_empty", extra={"pages": 0})
                    return products
                
                for page_num, page in enumerate(pdf.pages, 1):
                    # Try table extraction first (more structured)
                    tables = page.extract_tables()
                    
                    if tables:
                        products.extend(
                            self._extract_from_tables(tables, page_num)
                        )
                    else:
                        # Fallback to text extraction
                        text = page.extract_text()
                        if text:
                            products.extend(
                                self._extract_from_text(text, page_num)
                            )
                            
        except Exception as e:
            logger.error(
                "pdf_extraction_failed",
                extra={
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                },
                exc_info=True
            )
            raise FileProcessingError(
                message=f"Failed to process PDF: {str(e)}"
            )
        
        self._log_extraction_complete(len(products))
        return products
    
    def _extract_from_tables(
        self, 
        tables: List[List[List[str]]], 
        page_num: int
    ) -> List[RawProduct]:
        """Extract products from PDF tables with schema detection."""
        from services.list_schema_detector import ListSchemaDetector
        
        products = []
        
        for table in tables:
            if not table or len(table) < 2:
                continue
            
            # Get header and detect schema
            header = table[0] if table[0] else []
            if not header:
                continue
            
            # Detect catalog schema
            detector = ListSchemaDetector()
            schema = detector.detect(header, table[1:6])  # Use first 5 rows as sample
            
            logger.info(
                "pdf_table_schema_detected",
                extra={
                    "page": page_num,
                    "schema_type": schema.schema_type,
                    "confidence": schema.confidence,
                    "columns": len(header)
                }
            )
            
            # Extract based on detected schema
            if schema.schema_type == "automotive_parts":
                products.extend(self._extract_automotive_parts(header, table[1:], schema))
            else:
                # Default to price list extraction
                products.extend(self._extract_price_list(header, table[1:], schema))
        
        return products
    
    def _extract_automotive_parts(
        self,
        header: List[str],
        rows: List[List[str]],
        schema
    ) -> List[RawProduct]:
        """Extract automotive parts catalog entries."""
        products = []
        
        for row in rows:
            if not row or len(row) < len(header):
                continue
            
            # Create column dict
            columns = {}
            name_parts = []
            
            for i, (col_name, cell_value) in enumerate(zip(header, row)):
                if not col_name or not cell_value:
                    continue
                
                cleaned_value = self._clean_text(cell_value)
                if cleaned_value:
                    columns[col_name] = cleaned_value
                    
                    # Build name from key columns
                    if schema.key_column and col_name == schema.key_column:
                        name_parts.insert(0, cleaned_value)
                    elif any(kw in col_name.lower() for kw in ['año', 'year', 'motor', 'engine']):
                        name_parts.append(cleaned_value)
            
            if columns:
                # Name is combination of key identifiers
                name = " | ".join(name_parts) if name_parts else list(columns.values())[0]
                
                products.append(RawProduct(
                    name=name,
                    price_text="",  # No price in automotive catalogs
                    raw_line=str(row),
                    columns=columns,
                    catalog_type="automotive_parts"
                ))
        
        return products
    
    def _extract_price_list(
        self,
        header: List[str],
        rows: List[List[str]],
        schema
    ) -> List[RawProduct]:
        """Extract traditional price list entries."""
        products = []
        
        # Detect name and price columns
        name_col, price_col = self._detect_columns(header)
        
        for row in rows:
            if not row or len(row) <= max(name_col, price_col):
                continue
            
            name = self._clean_text(row[name_col])
            price_text = self._clean_text(row[price_col])
            
            if name and price_text:
                # Also store all columns for flexibility
                columns = {
                    col_name: self._clean_text(cell)
                    for col_name, cell in zip(header, row)
                    if col_name and cell
                }
                
                products.append(RawProduct(
                    name=name,
                    price_text=price_text,
                    raw_line=str(row),
                    columns=columns,
                    catalog_type="price_list"
                ))
        
        return products
    
    def _extract_from_text(
        self, 
        text: str, 
        page_num: int
    ) -> List[RawProduct]:
        """Extract products from plain text using regex."""
        products = []
        lines = text.split('\n')
        
        for line in lines:
            # Find price in line
            price_match = self._find_price(line)
            if price_match:
                # Name is everything except the price
                name = line.replace(price_match, '').strip()
                if len(name) > 2:  # Avoid very short names
                    products.append(RawProduct(
                        name=name,
                        price_text=price_match,
                        raw_line=line,
                        catalog_type="price_list"
                    ))
        
        return products
    
    def _find_price(self, text: str) -> Optional[str]:
        """Find a price in text using multiple patterns."""
        for pattern in PRICE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                return match.group()
        return None
    
    def _detect_columns(self, header: List[str]) -> tuple:
        """Detect name and price columns from header."""
        name_col = 0
        price_col = 1
        
        for i, col in enumerate(header):
            col_lower = (col or '').lower()
            if any(word in col_lower for word in ['nombre', 'producto', 'item', 'name', 'descripcion']):
                name_col = i
            if any(word in col_lower for word in ['precio', 'price', 'valor', 'costo', 'cost']):
                price_col = i
        
        return name_col, price_col
    
    @staticmethod
    def _clean_text(text: Optional[str]) -> str:
        """Clean and normalize extracted text."""
        if not text:
            return ''
        # Remove multiple spaces and special characters
        return ' '.join(text.split()).strip()
