"""
Shared Column Extraction Logic.

This module contains the refined column detection logic used across
all extractors (Excel, PDF, Images). It provides:

1. Header-based column mapping
2. Content-based column detection (for misaligned headers)
3. Column content validation
4. Brand separation from code cells
5. Subtitle/category row detection

The logic was developed and refined for Excel parsing and is now
shared to ensure consistent extraction across all file types.
"""
import re
import logging
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)


# Known header keywords for column detection
# Priority: 'reference' columns are the REAL product codes, 'internal_code' is distributor's internal code
HEADER_KEYWORDS = {
    # REFERENCIA is the actual product code (priority over 'codigo')
    'reference': ['referencia', 'reference', 'ref', 'part', 'parte', 'part number', 'nro parte'],
    # CODIGO is often an internal distributor code (secondary)
    'internal_code': ['codigo', 'código', 'code', 'sku', 'interno', 'internal'],
    'name': ['descripcion', 'descripción', 'nombre', 'producto', 'item', 'name', 'description', 'articulo', 'artículo'],
    'brand': ['marca', 'brand', 'fabricante', 'manufacturer'],
    'price': ['precio', 'price', 'usd', 'eur', 'bs', 'valor', 'costo', 'cost', 'amount', 'pvp', 'mayor', 'detal'],
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

# Price placeholder values (indicate subtitle rows, not real products)
PRICE_PLACEHOLDERS = ['-', '--', '---', 'n/a', 'N/A', '$', '-$', '0', '0.00', '0,00', '']

# Common automotive brands found in catalogs
# These are pre-populated for brand separation from code cells
COMMON_BRANDS = [
    # International/US Brands
    'MOTTA', 'HARFON', 'PORTER USA', 'PORTER', 'QP', 'GM', 'DTS', 
    'KODIAK', 'FOCUS', 'USA', 'LASER', 'FC', 'PFI', 'STD', 
    'ELECTRO AUTO', 'B-METAL', 'S-MITS', 'MITS', 'DENSO',
    # European
    'BOSCH', 'VALEO', 'HELLA', 'BERU', 'NGK', 'MAHLE',
    # Asian
    'TOYOTA', 'HONDA', 'NISSAN', 'HYUNDAI', 'KIA', 'MITSUBISHI',
    'MAZDA', 'SUBARU', 'SUZUKI', 'ISUZU', 'DAIHATSU',
    # Chinese
    'CHERY', 'GEELY', 'BYD', 'GREAT WALL', 'JAC', 'CHANGAN',
    # Parts brands
    'ACDelco', 'ACDELCO', 'MONROE', 'GATES', 'DAYCO', 'SKF',
    'TIMKEN', 'FAG', 'INA', 'NTN', 'KOYO', 'NSK',
    # Venezuelan/Regional
    'COVALCA', 'METAL', 'ELECTRICO', 'AUTO',
    # Aftermarket
    'DORMAN', 'SEALED POWER', 'FEDERAL MOGUL', 'STANDARD',
    'PRO WIRE', 'PROWIRE', 'WESCO', 'WILSON', 'WAI',
]



class ColumnExtractor:
    """
    Shared column detection and refinement logic.
    
    Provides methods for:
    - Mapping column names to semantic purposes
    - Content-based column detection for misaligned headers
    - Validation of column content types
    - Brand separation from combined code+brand cells
    - Subtitle/category row detection
    """
    
    def __init__(self, known_brands: Optional[List[str]] = None):
        """
        Initialize column extractor with brand detection.
        
        Pre-populates with common automotive brands for automatic
        brand separation from code cells.
        
        Args:
            known_brands: Additional brand names for separation
        """
        # Start with common brands
        self.known_brands = set(b.upper() for b in COMMON_BRANDS)
        
        # Add any additional brands
        if known_brands:
            for b in known_brands:
                if b:
                    self.known_brands.add(b.upper())
        
        # Compile patterns once
        self.price_pattern = re.compile(r'^[\$€]?\s*[\d\.,]+\s*[\$€]?$')
        self.code_pattern = re.compile(r'^[A-Z0-9][\w\-]{2,30}$', re.IGNORECASE)
    
    def map_columns_by_headers(self, columns: List[str]) -> Dict[str, str]:
        """
        Map columns to semantic purposes based on header names.
        
        Skips 'Unnamed' columns (artifacts of merged cells).
        Uses word-boundary matching to avoid false positives.
        
        Args:
            columns: List of column names from data source
            
        Returns:
            Dict mapping purpose -> column_name
        """
        column_map = {}
        
        for col in columns:
            col_str = str(col).strip()
            col_lower = col_str.lower()
            
            # Skip 'Unnamed' columns - artifacts of merged cells
            if col_lower.startswith('unnamed'):
                continue
            
            # Check each category of keywords
            for purpose, keywords in HEADER_KEYWORDS.items():
                if purpose in column_map:
                    continue  # Already found this column type
                
                # Use word-boundary matching
                for kw in keywords:
                    if (col_lower == kw or 
                        col_lower.startswith(kw + ' ') or 
                        col_lower.endswith(' ' + kw) or 
                        (' ' + kw + ' ') in col_lower or
                        col_lower.startswith(kw)):
                        column_map[purpose] = col
                        break
                else:
                    continue
                break
        
        return column_map
    
    def map_columns_by_content(
        self,
        data_rows: List[Dict[str, Any]],
        header_map: Dict[str, str],
        sample_size: int = 20
    ) -> Dict[str, str]:
        """
        Enhanced column mapping using content analysis.
        
        When headers are misaligned, analyzes actual data content
        to determine column purposes.
        
        Args:
            data_rows: List of row dictionaries with column values
            header_map: Initial mapping from header-based detection
            sample_size: Number of rows to sample for analysis
            
        Returns:
            Enhanced column mapping
        """
        if not data_rows:
            return header_map
        
        # Get all column names from first row
        all_columns = list(data_rows[0].keys()) if data_rows else []
        
        # Validate header-mapped columns first
        validated_map = {}
        for purpose, col in header_map.items():
            if col in all_columns:
                is_valid = self._validate_column_content(
                    data_rows[:sample_size], col, purpose
                )
                if is_valid:
                    validated_map[purpose] = col
                else:
                    logger.warning(
                        f"Column '{col}' mapped as '{purpose}' by header but "
                        "content doesn't match - removing mapping"
                    )
        
        # Content-based detection for unmapped columns
        column_map = validated_map.copy()
        column_scores = {}
        
        sample_rows = data_rows[:sample_size]
        
        for col in all_columns:
            if col in column_map.values():
                continue  # Already mapped
            
            # Skip unnamed columns
            if str(col).lower().startswith('unnamed'):
                continue
            
            scores = {
                'price': 0,
                'reference': 0,
                'internal_code': 0,
                'brand': 0,
                'name': 0
            }
            
            for row in sample_rows:
                val = row.get(col)
                if val is None:
                    continue
                    
                val_str = str(val).strip()
                if not val_str or val_str.lower() in ['nan', 'none']:
                    continue
                
                # Price detection
                val_clean = val_str.replace(',', '.').replace(' ', '')
                if self.price_pattern.match(val_clean):
                    scores['price'] += 2
                
                # Code detection
                elif self.code_pattern.match(val_str):
                    if len(val_str) > 5 and re.search(r'[A-Z].*\d|\d.*[A-Z]', val_str.upper()):
                        scores['reference'] += 1
                    elif len(val_str) <= 10:
                        scores['internal_code'] += 1
                
                # Brand detection
                elif len(val_str) <= 20 and val_str.isupper() and val_str.isalpha():
                    scores['brand'] += 1
                
                # Name detection
                elif len(val_str) > 20:
                    scores['name'] += 1
            
            column_scores[col] = scores
        
        # Assign columns based on highest scores
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
            
            if best_col and best_score >= 3:
                column_map[purpose] = best_col
                logger.debug(f"Content-based detection: {purpose} -> {best_col}")
        
        return column_map
    
    def _validate_column_content(
        self,
        rows: List[Dict[str, Any]],
        col_name: str,
        purpose: str
    ) -> bool:
        """
        Validate if a column's content matches its expected purpose.
        
        Returns True if at least 40% of values match the expected pattern.
        """
        values = [row.get(col_name) for row in rows if row.get(col_name) is not None]
        if not values:
            return False
        
        valid_count = 0
        total_count = len(values)
        
        for val in values:
            val_str = str(val).strip()
            if not val_str or val_str.lower() in ['nan', 'none']:
                total_count -= 1
                continue
            
            if purpose == 'price':
                val_clean = val_str.replace(',', '.').replace(' ', '').replace('$', '').replace('€', '')
                try:
                    float(val_clean)
                    valid_count += 1
                except ValueError:
                    pass
            
            elif purpose in ['reference', 'internal_code']:
                if self.code_pattern.match(val_str):
                    if len(val_str.split()) <= 2:  # Codes don't have many spaces
                        valid_count += 1
            
            elif purpose == 'brand':
                if len(val_str) <= 20 and val_str.isupper():
                    valid_count += 1
            
            elif purpose == 'name':
                if len(val_str) > 3 and not val_str.replace('.', '').isdigit():
                    valid_count += 1
        
        if total_count == 0:
            return False
        
        return (valid_count / total_count) >= 0.4
    
    def find_best_name_column(
        self,
        data_rows: List[Dict[str, Any]],
        existing_columns: List[str],
        sample_size: int = 20
    ) -> Optional[str]:
        """
        Find the best column for product names/descriptions.
        
        Uses average text length - description columns have longer text.
        
        Args:
            data_rows: List of row dictionaries
            existing_columns: Columns already mapped to other purposes
            sample_size: Number of rows to sample
            
        Returns:
            Column name or None
        """
        if not data_rows:
            return None
        
        best_col = None
        best_avg_len = 0
        
        all_columns = list(data_rows[0].keys()) if data_rows else []
        sample = data_rows[:sample_size]
        
        for col in all_columns:
            if col in existing_columns:
                continue
            if str(col).lower().startswith('unnamed'):
                continue
            
            lengths = []
            for row in sample:
                val = row.get(col)
                if val is not None:
                    val_str = str(val).strip()
                    if val_str and val_str.lower() not in ['nan', 'none']:
                        lengths.append(len(val_str))
            
            if lengths:
                avg_len = sum(lengths) / len(lengths)
                if avg_len > best_avg_len:
                    best_avg_len = avg_len
                    best_col = col
        
        # Only use if average length suggests descriptions (>15 chars)
        if best_col and best_avg_len > 15:
            return best_col
        
        return None
    
    def is_subtitle_row(
        self,
        name_value: str,
        code_value: str,
        brand_value: str,
        price_text: str
    ) -> bool:
        """
        Detect if a row is a subtitle/category header, not a product.
        
        Subtitle rows typically have:
        - A description but no code
        - No brand
        - No real price (placeholder or empty)
        
        Args:
            name_value: Product name/description
            code_value: Product code
            brand_value: Brand name
            price_text: Price as text
            
        Returns:
            True if this looks like a subtitle row
        """
        has_name = bool(name_value and name_value.strip())
        has_code = bool(code_value and code_value.strip())
        has_brand = bool(brand_value and brand_value.strip())
        
        # Check if price is a placeholder
        price_is_placeholder = (
            not price_text or
            price_text.strip().lower() in [p.lower() for p in PRICE_PLACEHOLDERS]
        )
        
        # Subtitle: has name but missing code, brand, AND real price
        if has_name and not has_code and not has_brand and price_is_placeholder:
            return True
        
        return False
    
    def should_skip_row(self, text: str) -> bool:
        """
        Check if a row should be skipped (metadata, category headers, etc.).
        
        Args:
            text: Row text to check
            
        Returns:
            True if row should be skipped
        """
        if not text:
            return True
        
        text_lower = text.lower().strip()
        
        for pattern in SKIP_PATTERNS:
            if re.match(pattern, text_lower, re.IGNORECASE):
                return True
        
        return False
    
    def separate_brand_from_code(self, value: str) -> Tuple[str, Optional[str]]:
        """
        Separate brand from code if combined in same cell.
        
        Examples:
            "28-124 HARFON" -> ("28-124", "HARFON")
            "12536N HARFON" -> ("12536N", "HARFON")
            "7659N-KODIAK" -> ("7659N", "KODIAK")
            "6674 MOTTA" -> ("6674", "MOTTA")
            "13575N" -> ("13575N", None)
        
        Args:
            value: Raw cell value
            
        Returns:
            Tuple of (code, brand) or (value, None) if no brand found
        """
        if not value:
            return (value, None)
        
        value_str = str(value).strip()
        value_upper = value_str.upper()
        
        # Strategy 1: Check if value ends with a known brand (highest priority)
        for brand in sorted(self.known_brands, key=len, reverse=True):
            if value_upper.endswith(' ' + brand):
                code = value_str[:-len(brand)-1].strip()
                return (code, brand)
            # Also check with hyphen separator (e.g., "7659N-KODIAK")
            if value_upper.endswith('-' + brand):
                code = value_str[:-len(brand)-1].strip()
                return (code, brand)
        
        # Strategy 2: Check if value starts with a known brand
        for brand in sorted(self.known_brands, key=len, reverse=True):
            if value_upper.startswith(brand + ' '):
                code = value_str[len(brand)+1:].strip()
                return (code, brand)
        
        # Strategy 3: Auto-detect unknown brand at end
        # Pattern: CODE followed by space and UPPERCASE word(s) at end
        # Examples: "28-102 HARFON", "8280 HARFON", "CS-130-7933-1 SOMETHING"
        match = re.match(
            r'^([\w\-\.]+(?:/[\w\-\.]+)?)\s+([A-Z][A-Z\s]{1,20})$',
            value_upper
        )
        if match:
            potential_code = match.group(1)
            potential_brand = match.group(2).strip()
            
            # Validate: brand should be mostly letters, code should have numbers
            has_numbers_in_code = any(c.isdigit() for c in potential_code)
            is_alpha_brand = potential_brand.replace(' ', '').isalpha()
            brand_len = len(potential_brand)
            
            if has_numbers_in_code and is_alpha_brand and 2 <= brand_len <= 20:
                # Learn this brand for future
                self.known_brands.add(potential_brand)
                logger.debug(f"Auto-learned brand: {potential_brand}")
                return (potential_code, potential_brand)
        
        # Strategy 4: Brand with hyphen separator
        # Pattern: "7659N-KODIAK" or "A7401N-QP"
        if '-' in value_upper:
            parts = value_upper.rsplit('-', 1)
            if len(parts) == 2:
                potential_code, potential_brand = parts
                potential_brand = potential_brand.strip()
                
                # Brand should be all letters, 2-15 chars
                if potential_brand.isalpha() and 2 <= len(potential_brand) <= 15:
                    # Code part should have at least one digit
                    if any(c.isdigit() for c in potential_code):
                        self.known_brands.add(potential_brand)
                        logger.debug(f"Auto-learned brand from hyphen: {potential_brand}")
                        return (potential_code, potential_brand)
        
        return (value_str, None)
    
    def add_known_brands(self, brands: List[str]) -> None:
        """Add brands to the known brands set."""
        for brand in brands:
            if brand:
                self.known_brands.add(brand.upper().strip())
    
    def extract_code_prioritized(
        self,
        reference_value: str,
        internal_code_value: str
    ) -> Tuple[str, str]:
        """
        Get the correct product code, prioritizing reference over internal code.
        
        Args:
            reference_value: Value from REFERENCIA column
            internal_code_value: Value from CODIGO column
            
        Returns:
            Tuple of (primary_code, internal_code)
        """
        ref = reference_value.strip() if reference_value else ""
        internal = internal_code_value.strip() if internal_code_value else ""
        
        # Clean nan/none values
        if ref.lower() in ['nan', 'none']:
            ref = ""
        if internal.lower() in ['nan', 'none']:
            internal = ""
        
        # Primary code is reference if available, else internal
        primary = ref if ref else internal
        
        return (primary, internal)


# Singleton instance for shared use
_column_extractor: Optional[ColumnExtractor] = None


def get_column_extractor(known_brands: Optional[List[str]] = None) -> ColumnExtractor:
    """
    Get shared ColumnExtractor instance.
    
    Args:
        known_brands: Optional list of known brand names
        
    Returns:
        ColumnExtractor instance
    """
    global _column_extractor
    
    if _column_extractor is None:
        _column_extractor = ColumnExtractor(known_brands)
    elif known_brands:
        _column_extractor.add_known_brands(known_brands)
    
    return _column_extractor


def load_brands_from_database(db_session) -> List[str]:
    """
    Load known brands from BrandRegistry database table.
    
    This should be called during extractor initialization to ensure
    brand separation uses all historically learned brands.
    
    Args:
        db_session: SQLAlchemy database session
        
    Returns:
        List of brand names from database
    """
    try:
        from database.models import BrandRegistry
        
        # Query active brands from database
        db_brands = db_session.query(BrandRegistry.normalized_name).filter(
            BrandRegistry.is_active == True
        ).all()
        
        brands = [b[0] for b in db_brands if b[0]]
        
        if brands:
            logger.info(f"Loaded {len(brands)} brands from database")
            
            # Add to singleton extractor
            extractor = get_column_extractor()
            extractor.add_known_brands(brands)
        
        return brands
        
    except Exception as e:
        logger.warning(f"Could not load brands from database: {e}")
        return []


def refresh_brands_from_db(db_session) -> None:
    """
    Refresh the brand list from database.
    
    Call this periodically or when new brands are learned.
    """
    load_brands_from_database(db_session)
