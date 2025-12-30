"""
PDF extractor using pdfplumber.

Extracts products and prices from PDF files with support for
tables and text-based extraction. 

Uses shared ColumnExtractor for consistent column detection.
Implements tiered extraction based on PDF complexity:
- Level 1 (Easy): Clear tables -> Use ColumnExtractor directly
- Level 2 (Medium): Text-based columns -> Try local Ollama AI
- Level 3 (Hard): Images/scanned -> Use Gemini Vision API
"""
import io
import re
import logging
from typing import List, Optional, Dict, Any
from enum import Enum

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from .base import BaseExtractor, RawProduct
from .column_extractor import get_column_extractor, HEADER_KEYWORDS
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)


class ExtractionDifficulty(Enum):
    """PDF extraction difficulty levels."""
    EASY = "easy"      # Clear tables, use ColumnExtractor
    MEDIUM = "medium"  # Text columns, may need Ollama
    HARD = "hard"      # Scanned/images, needs Gemini


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
    
    Uses shared ColumnExtractor for consistent column detection.
    """
    
    def __init__(self):
        """Initialize PDF extractor with shared ColumnExtractor."""
        super().__init__()
        self.column_extractor = get_column_extractor()
    
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
                
                # Assess extraction difficulty
                difficulty = self._assess_difficulty(pdf)
                
                logger.info(
                    "pdf_difficulty_assessed",
                    extra={
                        "difficulty": difficulty.value,
                        "pages": len(pdf.pages)
                    }
                )
                
                if difficulty == ExtractionDifficulty.EASY:
                    # Use ColumnExtractor-based extraction
                    products = await self._extract_easy(pdf)
                elif difficulty == ExtractionDifficulty.MEDIUM:
                    # Try local extraction, fallback to Ollama
                    products = await self._extract_medium(pdf)
                else:
                    # Use Gemini Vision for hard cases
                    products = await self._extract_hard(content)
                    
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
    
    def _assess_difficulty(self, pdf) -> ExtractionDifficulty:
        """
        Assess how difficult the PDF is to extract.
        
        Returns:
            ExtractionDifficulty: EASY, MEDIUM, or HARD
        """
        if not pdf.pages:
            return ExtractionDifficulty.HARD
        
        # Sample first page
        page = pdf.pages[0]
        
        # Check for clear tables
        tables = page.extract_tables()
        if tables and len(tables) > 0:
            # Check if tables have good structure
            for table in tables:
                if table and len(table) >= 3 and len(table[0]) >= 3:
                    return ExtractionDifficulty.EASY
        
        # Check for extractable text
        text = page.extract_text()
        if text and len(text) > 200:
            # Has text but no clear tables
            return ExtractionDifficulty.MEDIUM
        
        # Likely scanned/image-based
        return ExtractionDifficulty.HARD
    
    async def _extract_easy(self, pdf) -> List[RawProduct]:
        """
        Extract from PDFs with clear tables using ColumnExtractor.
        
        This uses the same refined logic as Excel parsing.
        Persists header from first page for multi-page PDFs.
        """
        products = []
        persistent_header = None
        persistent_column_map = None
        
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            
            # Log EVERY page for diagnostics
            logger.info(
                "pdf_page_processing",
                extra={
                    "page": page_num,
                    "tables_found": len(tables) if tables else 0,
                    "first_table_rows": len(tables[0]) if tables and tables[0] else 0
                }
            )
            
            if not tables:
                # No tables detected, try text extraction as fallback
                text = page.extract_text()
                if text:
                    logger.info(
                        "pdf_page_no_tables_trying_text",
                        extra={
                            "page": page_num,
                            "text_length": len(text)
                        }
                    )
                    text_products = self._extract_from_text(text, page_num)
                    if text_products:
                        logger.info(
                            "pdf_page_text_extraction",
                            extra={
                                "page": page_num,
                                "products_from_text": len(text_products)
                            }
                        )
                        products.extend(text_products)
                continue
            
            for table_idx, table in enumerate(tables):
                if not table or len(table) < 2:
                    continue
                
                # Get first row to check if it's a header
                first_row = [str(cell).strip() if cell else '' for cell in table[0]]
                first_row_lower = ' '.join(first_row).lower()
                
                # Check if first row looks like a header
                header_keywords = ['codigo', 'descripcion', 'precio', 'mayor', 
                                   'code', 'description', 'price', 'detal']
                is_header_row = any(kw in first_row_lower for kw in header_keywords)
                
                if is_header_row:
                    # Found a header row - save it for reuse
                    persistent_header = first_row
                    persistent_column_map = self.column_extractor.map_columns_by_headers(first_row)
                    data_start = 1
                    
                    logger.info(
                        "pdf_header_found",
                        extra={
                            "page": page_num,
                            "header": first_row[:5],
                            "column_map": persistent_column_map
                        }
                    )
                elif persistent_header:
                    # No header in this row, but we have a persistent one
                    data_start = 0
                else:
                    # No header found yet and this doesn't look like one
                    # Try to infer structure: [CODIGO, DESCRIPCION, PRECIO]
                    if len(first_row) >= 3:
                        # Assume standard 3-column structure
                        persistent_header = ['CODIGO', 'DESCRIPCION', 'Mayor $']
                        persistent_column_map = {
                            'reference': 'CODIGO',
                            'name': 'DESCRIPCION',
                            'price': 'Mayor $'
                        }
                        data_start = 0
                        
                        logger.info(
                            "pdf_header_inferred",
                            extra={
                                "page": page_num,
                                "inferred_header": persistent_header
                            }
                        )
                    else:
                        continue
                
                if not persistent_header:
                    continue
                
                # Convert table rows to dict format
                data_rows = []
                for row in table[data_start:]:
                    if row:
                        row_dict = {}
                        for i, cell in enumerate(row):
                            if i < len(persistent_header):
                                col_name = persistent_header[i]
                                row_dict[col_name] = str(cell).strip() if cell else ''
                        if row_dict:
                            data_rows.append(row_dict)
                
                # Use persistent column map, enhance with content detection if needed
                column_map = persistent_column_map.copy() if persistent_column_map else {}
                
                if data_rows and not column_map:
                    column_map = self.column_extractor.map_columns_by_content(
                        data_rows, {}
                    )
                
                # Find name column if not mapped
                if 'name' not in column_map and data_rows:
                    name_col = self.column_extractor.find_best_name_column(
                        data_rows, list(column_map.values())
                    )
                    if name_col:
                        column_map['name'] = name_col
                
                logger.info(
                    "pdf_columns_mapped",
                    extra={
                        "page": page_num,
                        "column_map": column_map,
                        "rows_in_table": len(data_rows)
                    }
                )
                
                # Extract products using mapped columns
                page_products = self._extract_with_column_map(data_rows, column_map)
                products.extend(page_products)
                
                # Log first page specifically
                if page_num == 1:
                    logger.info(
                        "pdf_first_page_extracted",
                        extra={
                            "products_found": len(page_products),
                            "header": persistent_header[:5] if persistent_header else None,
                            "column_map": column_map
                        }
                    )
        
        return products
    
    def _extract_with_column_map(
        self,
        rows: List[Dict[str, str]],
        column_map: Dict[str, str]
    ) -> List[RawProduct]:
        """Extract products using shared column mapping."""
        products = []
        
        name_col = column_map.get('name')
        price_col = column_map.get('price')
        brand_col = column_map.get('brand')
        ref_col = column_map.get('reference')
        internal_col = column_map.get('internal_code')
        
        # Row patterns to skip (headers, metadata)
        skip_values = {
            'codigo', 'code', 'descripcion', 'description', 'precio',
            'price', 'mayor', 'detal', 'mayor $', 'precios sujetos',
            'repuestos', 'lista de precios', 'rif', 'j-'
        }
        
        for row in rows:
            name = row.get(name_col, '') if name_col else ''
            price_text = row.get(price_col, '') if price_col else ''
            brand = row.get(brand_col, '') if brand_col else ''
            ref_value = row.get(ref_col, '') if ref_col else ''
            internal_value = row.get(internal_col, '') if internal_col else ''
            
            # Skip header-like rows (CODIGO, DESCRIPCION, etc.)
            name_lower = name.lower().strip()
            ref_lower = ref_value.lower().strip() if ref_value else ''
            
            if name_lower in skip_values or ref_lower in skip_values:
                logger.debug(f"PDF skipping header row: {name} | {ref_value}")
                continue
            
            # Skip if name looks like a header keyword
            if any(skip in name_lower for skip in ['precios sujetos', 'lista de precio', 'repuestos y']):
                logger.debug(f"PDF skipping metadata row: {name}")
                continue
            
            # Get prioritized code
            code, internal_code = self.column_extractor.extract_code_prioritized(
                ref_value, internal_value
            )
            
            # Try to separate brand from code if brand not found
            # Examples: "28-124 HARFON" -> code="28-124", brand="HARFON"
            if code and not brand:
                separated_code, separated_brand = self.column_extractor.separate_brand_from_code(code)
                if separated_brand:
                    code = separated_code
                    brand = separated_brand
                    logger.debug(f"PDF brand separated: {separated_code} | {separated_brand}")
            
            # Check if subtitle row
            if self.column_extractor.is_subtitle_row(name, code, brand, price_text):
                logger.debug(f"PDF skipping subtitle: {name}")
                continue
            
            # Skip if no name
            if not name or self.column_extractor.should_skip_row(name):
                continue
            
            # Build columns dict
            columns = {
                'code': code,
                'brand': brand,
                'price': price_text,
            }
            if internal_code:
                columns['internal_code'] = internal_code
            
            # Add any other columns
            for col_name, value in row.items():
                if col_name not in [name_col, price_col, brand_col, ref_col, internal_col]:
                    if value and value.lower() not in ['nan', 'none', '']:
                        columns[col_name] = value
            
            products.append(RawProduct(
                name=name,
                price_text=price_text,
                raw_line=f"{code} | {name} | {brand} | {price_text}",
                columns=columns,
                catalog_type="price_list"
            ))
        
        return products
    
    async def _extract_medium(self, pdf) -> List[RawProduct]:
        """
        Extract from PDFs with text but no clear tables.
        
        Tries text-based extraction first.
        Could use local Ollama AI for structure detection if needed.
        """
        products = []
        
        for page_num, page in enumerate(pdf.pages, 1):
            # First try table extraction
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    if table and len(table) >= 2:
                        products.extend(
                            self._extract_from_legacy_table(table, page_num)
                        )
            
            # Also extract from text
            text = page.extract_text()
            if text:
                products.extend(
                    self._extract_from_text(text, page_num)
                )
        
        # If we got very few products, could try Ollama here
        # For now, we return what we have
        if len(products) < 5:
            logger.warning(
                "pdf_medium_low_extraction",
                extra={
                    "products_found": len(products),
                    "hint": "Consider Ollama assistance"
                }
            )
        
        return products
    
    async def _extract_hard(self, content: bytes) -> List[RawProduct]:
        """
        Extract from hard PDFs using Gemini Vision.
        
        Converts PDF pages to images and uses Gemini for analysis.
        """
        try:
            from services.extractors.gemini_pdf_extractor import GeminiPDFExtractor
            
            logger.info("pdf_hard_using_gemini")
            extractor = GeminiPDFExtractor()
            return await extractor.extract(content)
            
        except ImportError:
            logger.warning("Gemini PDF extractor not available")
            return []
        except Exception as e:
            logger.error(f"Gemini extraction failed: {e}")
            return []
    
    def _extract_from_legacy_table(
        self,
        table: List[List[str]],
        page_num: int
    ) -> List[RawProduct]:
        """Legacy table extraction for fallback."""
        products = []
        
        if not table or len(table) < 2:
            return products
        
        header = table[0] if table[0] else []
        if not header:
            return products
        
        # Detect name and price columns
        name_col, price_col = self._detect_columns(header)
        
        for row in table[1:]:
            if not row or len(row) <= max(name_col, price_col):
                continue
            
            name = self._clean_text(row[name_col])
            price_text = self._clean_text(row[price_col])
            
            if name and price_text:
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
            # Skip empty or header-like lines
            if self.column_extractor.should_skip_row(line):
                continue
            
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
        """Detect name and price columns from header using shared keywords."""
        name_col = 0
        price_col = 1
        
        for i, col in enumerate(header):
            col_lower = (col or '').lower()
            
            # Check for name keywords
            for kw in HEADER_KEYWORDS.get('name', []):
                if kw in col_lower:
                    name_col = i
                    break
            
            # Check for price keywords
            for kw in HEADER_KEYWORDS.get('price', []):
                if kw in col_lower:
                    price_col = i
                    break
        
        return name_col, price_col
    
    @staticmethod
    def _clean_text(text: Optional[str]) -> str:
        """Clean and normalize extracted text."""
        if not text:
            return ''
        # Remove multiple spaces and special characters
        return ' '.join(str(text).split()).strip()
