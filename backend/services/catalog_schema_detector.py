"""
Catalog Schema Detector.

Automatically detects the type and structure of uploaded catalogs.
Supports both heuristic-based detection and optional AI-powered classification.
"""
import logging
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class CatalogType(str, Enum):
    """Supported catalog types."""
    PRICE_LIST = "price_list"  # Traditional name|price catalogs
    AUTOMOTIVE_PARTS = "automotive_parts"  # Vehicle parts with brand/model/year
    INVENTORY = "inventory"  # Stock/warehouse catalogs
    ELECTRONICS = "electronics"  # Electronic components
    UNKNOWN = "unknown"


@dataclass
class ColumnDefinition:
    """Definition of a catalog column."""
    name: str
    column_type: str  # "text", "price", "year", "code", "numeric"
    is_key: bool = False  # Is this a primary identifier column?
    is_brand: bool = False  # Is this a brand/manufacturer column?
    sub_columns: List[str] = None  # For multi-header columns (e.g., DENSO has 4 sub-cols)
    
    def __post_init__(self):
        if self.sub_columns is None:
            self.sub_columns = []


@dataclass
class CatalogSchema:
    """Detected or defined schema for a catalog."""
    schema_type: CatalogType
    columns: List[ColumnDefinition]
    key_column: Optional[str] = None  # Primary identifier column
    brand_columns: List[str] = None  # Columns containing brand/product codes
    confidence: float = 0.0  # Detection confidence (0-1)
    
    def __post_init__(self):
        if self.brand_columns is None:
            self.brand_columns = []


class CatalogSchemaDetector:
    """
    Detects catalog schema from headers and data.
    
    Uses heuristics to identify:
    - Price-based catalogs (name, price, quantity)
    - Automotive parts catalogs (brand/model, year, engine, part codes)
    - Inventory catalogs (SKU, description, stock)
    """
    
    # Patterns for column detection
    PRICE_KEYWORDS = ['precio', 'price', 'valor', 'costo', 'cost', 'amount']
    NAME_KEYWORDS = ['nombre', 'producto', 'item', 'name', 'descripcion', 'description']
    YEAR_KEYWORDS = ['año', 'year', 'modelo']
    ENGINE_KEYWORDS = ['motor', 'engine', 'cilindrada']
    BRAND_KEYWORDS = ['marca', 'brand', 'fabricante', 'manufacturer']
    MODEL_KEYWORDS = ['modelo', 'model']
    
    # Known automotive part brands
    AUTO_PART_BRANDS = [
        'CHAMPION', 'NGK', 'DENSO', 'BOSCH', 'BERU', 'AUTOLITE',
        'AC DELCO', 'MOTORCRAFT', 'STANDARD', 'PLATINUM'
    ]
    
    def detect(
        self, 
        headers: List[str], 
        sample_rows: Optional[List[List[str]]] = None
    ) -> CatalogSchema:
        """
        Detect catalog schema from headers and optional sample data.
        
        Args:
            headers: Column headers from the catalog
            sample_rows: Optional sample data rows for better detection
            
        Returns:
            CatalogSchema: Detected schema with confidence score
        """
        logger.info(
            "schema_detection_started",
            extra={"header_count": len(headers)}
        )
        
        # Clean headers
        headers = [self._clean_header(h) for h in headers]
        
        # Try automotive parts detection first (more specific)
        auto_schema = self._detect_automotive_parts(headers, sample_rows)
        if auto_schema.confidence > 0.7:
            logger.info(
                "schema_detected",
                extra={
                    "type": auto_schema.schema_type,
                    "confidence": auto_schema.confidence
                }
            )
            return auto_schema
        
        # Try price list detection
        price_schema = self._detect_price_list(headers, sample_rows)
        if price_schema.confidence > 0.6:
            logger.info(
                "schema_detected",
                extra={
                    "type": price_schema.schema_type,
                    "confidence": price_schema.confidence
                }
            )
            return price_schema
        
        # Default to unknown with best guess
        best_schema = auto_schema if auto_schema.confidence > price_schema.confidence else price_schema
        logger.warning(
            "schema_detection_uncertain",
            extra={
                "best_guess": best_schema.schema_type,
                "confidence": best_schema.confidence
            }
        )
        return best_schema
    
    def _detect_automotive_parts(
        self, 
        headers: List[str], 
        sample_rows: Optional[List[List[str]]]
    ) -> CatalogSchema:
        """Detect automotive parts catalog pattern."""
        confidence = 0.0
        columns = []
        brand_columns = []
        key_column = None
        
        # Check for automotive-specific patterns
        has_year = False
        has_engine = False
        has_model = False
        brand_count = 0
        
        for i, header in enumerate(headers):
            header_lower = header.lower()
            col_def = ColumnDefinition(name=header, column_type="text")
            
            # Check for year column
            if any(kw in header_lower for kw in self.YEAR_KEYWORDS):
                has_year = True
                col_def.column_type = "year"
                confidence += 0.2
            
            # Check for engine column
            elif any(kw in header_lower for kw in self.ENGINE_KEYWORDS):
                has_engine = True
                col_def.column_type = "text"
                confidence += 0.15
            
            # Check for model/brand column
            elif any(kw in header_lower for kw in self.MODEL_KEYWORDS + self.BRAND_KEYWORDS):
                has_model = True
                col_def.is_key = True
                key_column = header
                confidence += 0.15
            
            # Check for known auto part brands
            elif any(brand in header.upper() for brand in self.AUTO_PART_BRANDS):
                brand_count += 1
                col_def.is_brand = True
                col_def.column_type = "code"
                brand_columns.append(header)
                confidence += 0.1
            
            columns.append(col_def)
        
        # Boost confidence if we have multiple brand columns (typical of auto parts)
        if brand_count >= 2:
            confidence += 0.3
        
        # Check sample data for year patterns (e.g., "1997-1999", "2001-2003")
        if sample_rows and not has_year:
            for row in sample_rows[:5]:  # Check first 5 rows
                for cell in row:
                    if re.match(r'\d{4}\s*-\s*\d{4}', str(cell)):
                        has_year = True
                        confidence += 0.1
                        break
        
        return CatalogSchema(
            schema_type=CatalogType.AUTOMOTIVE_PARTS,
            columns=columns,
            key_column=key_column,
            brand_columns=brand_columns,
            confidence=min(confidence, 1.0)
        )
    
    def _detect_price_list(
        self, 
        headers: List[str], 
        sample_rows: Optional[List[List[str]]]
    ) -> CatalogSchema:
        """Detect traditional price list pattern."""
        confidence = 0.0
        columns = []
        key_column = None
        
        has_name = False
        has_price = False
        
        for i, header in enumerate(headers):
            header_lower = header.lower()
            col_def = ColumnDefinition(name=header, column_type="text")
            
            # Check for name column
            if any(kw in header_lower for kw in self.NAME_KEYWORDS):
                has_name = True
                col_def.is_key = True
                key_column = header
                confidence += 0.3
            
            # Check for price column
            elif any(kw in header_lower for kw in self.PRICE_KEYWORDS):
                has_price = True
                col_def.column_type = "price"
                confidence += 0.4
            
            columns.append(col_def)
        
        # Check sample data for price patterns
        if sample_rows and not has_price:
            for row in sample_rows[:5]:
                for cell in row:
                    cell_str = str(cell)
                    # Look for currency symbols or decimal numbers
                    if re.search(r'[\$€£]|\d+\.\d{2}', cell_str):
                        has_price = True
                        confidence += 0.2
                        break
        
        # Price list needs both name and price
        if has_name and has_price:
            confidence += 0.3
        
        return CatalogSchema(
            schema_type=CatalogType.PRICE_LIST,
            columns=columns,
            key_column=key_column,
            confidence=min(confidence, 1.0)
        )
    
    @staticmethod
    def _clean_header(header: str) -> str:
        """Clean and normalize header text."""
        if not header:
            return ""
        # Remove extra whitespace
        header = ' '.join(header.split())
        # Remove special characters but keep spaces and common separators
        header = re.sub(r'[^\w\s\-\./]', '', header)
        return header.strip()
