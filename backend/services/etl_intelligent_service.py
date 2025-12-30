"""
ETL Intelligent Service with Historical Validation.

Implements 3-layer intelligent data transformation:
1. Structural Analysis - Column discrimination
2. Historical Validation - Database matching
3. Sanitization & Review Flagging - Confidence-based review workflow
"""
import logging
import re
from typing import List, Dict, Optional, Tuple, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from database.models import MasterProduct, CodeRegistry, PriceList, BrandRegistry
from services.extractors.base import RawProduct
from services.code_correlation_service import CodeCorrelationService

logger = logging.getLogger(__name__)


class ETLIntelligentService:
    """
    Intelligent ETL service with historical validation.
    
    Transforms raw extracted data into normalized master products
    using AI-assisted code normalization and confidence scoring.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.confidence_threshold = 0.80
        self.correlation_service = CodeCorrelationService(db)
        
    async def process_file(
        self,
        raw_products: List[RawProduct],
        list_id: int,
        list_name: str
    ) -> List[MasterProduct]:
        """
        Process raw products with intelligent ETL.
        
        Args:
            raw_products: Raw extracted products
            list_id: Source price list ID
            list_name: Source price list name
            
        Returns:
            List of normalized master products
        """
        logger.info(
            "etl_processing_started",
            extra={
                "list_id": list_id,
                "raw_count": len(raw_products)
            }
        )
        
        # Get current max index number
        max_index = self.db.query(func.max(MasterProduct.index_number)).scalar() or 0
        
        transformed = []
        for idx, raw in enumerate(raw_products, start=1):
            product = await self._transform_product(
                raw,
                index_number=max_index + idx,
                list_id=list_id,
                list_name=list_name
            )
            transformed.append(product)
        
        logger.info(
            "etl_processing_completed",
            extra={
                "list_id": list_id,
                "transformed_count": len(transformed),
                "pending_review": sum(1 for p in transformed if p.review_status == "pending")
            }
        )
        
        return transformed
    
    async def _transform_product(
        self,
        raw: RawProduct,
        index_number: int,
        list_id: int,
        list_name: str
    ) -> MasterProduct:
        """Transform a single raw product through the 3 layers."""
        
        # Layer 1: Structural Analysis (already done by extractor)
        # We receive raw.name, raw.price_text, raw.raw_line, raw.columns
        
        # Extract basic fields - prioritize pre-extracted column data from parser
        description = raw.name or "Unknown Product"
        columns = raw.columns or {}
        
        # Get internal distributor code (if present)
        internal_code = columns.get('internal_code', '').strip() if columns.get('internal_code') else None
        
        # Use pre-extracted columns first (from ExcelParser), fallback to regex
        brand = columns.get('brand', '').strip() if columns.get('brand') else None
        if not brand:
            brand = self._extract_brand(raw.raw_line)
        
        raw_code = columns.get('code', '').strip() if columns.get('code') else None
        if not raw_code:
            raw_code = self._extract_code(raw.raw_line, description, brand)
        
        # NEW: Try to separate brand from code if combined in same cell
        if raw_code and not brand:
            separated_code, detected_brand = self.correlation_service.separate_brand_from_code(raw_code)
            if detected_brand:
                raw_code = separated_code
                brand = detected_brand
                logger.debug(f"Separated brand '{brand}' from code '{raw_code}'")
        
        # Also check if brand is embedded in the description
        if description and not brand:
            _, detected_brand = self.correlation_service.separate_brand_from_code(description)
            if detected_brand:
                brand = detected_brand
        
        price = self._parse_price(raw.price_text)
        
        # Layer 2: Historical Validation
        validation_result = await self._layer2_historical_validation(
            raw_code, description, brand
        )
        
        clean_code = validation_result["clean_code"]
        confidence = validation_result["confidence"]
        
        # Layer 3: Sanitization
        clean_code = self._layer3_sanitize_code(clean_code, brand, description)
        
        # Determine review status
        review_status = "pending" if confidence < self.confidence_threshold else "confirmed"
        
        # Create master product
        product = MasterProduct(
            index_number=index_number,
            clean_code=clean_code,
            description=description,
            brand=brand,
            price_usd=price,
            review_status=review_status,
            confidence_score=Decimal(str(confidence)),
            source_list_id=list_id,
            original_list_name=list_name,
            raw_data={
                "raw_line": raw.raw_line,
                "raw_code": raw_code,
                "internal_code": internal_code,
                "price_text": raw.price_text
            }
        )
        
        # Update registries for future correlation
        if review_status == "confirmed":
            await self._update_code_registry(clean_code, description, brand)
            
            # Learn the brand automatically
            if brand:
                self.correlation_service.learn_brand(brand)
            
            # Register distributor code mapping
            if internal_code and clean_code:
                self.correlation_service.register_distributor_code(
                    distributor_code=internal_code,
                    product_code=clean_code,
                    list_name=list_name,
                    list_id=list_id
                )
        
        return product
    
    async def _layer2_historical_validation(
        self,
        raw_code: str,
        description: str,
        brand: Optional[str]
    ) -> Dict[str, Any]:
        """
        Layer 2: Historical Validation.
        
        Queries CodeRegistry to find matches and validate codes.
        
        Returns:
            Dict with clean_code, confidence, and source
        """
        # Strategy 1: Search by description + brand
        if brand and description:
            existing = self.db.query(CodeRegistry).filter(
                func.lower(CodeRegistry.canonical_description).like(f"%{description.lower()[:50]}%"),
                func.lower(CodeRegistry.canonical_brand) == brand.lower()
            ).first()
            
            if existing:
                logger.debug(
                    "historical_match_found",
                    extra={"code": existing.clean_code, "method": "description_brand"}
                )
                return {
                    "clean_code": existing.clean_code,
                    "confidence": 0.95,
                    "source": "historical_match"
                }
        
        # Strategy 2: Exact code match
        code_match = self.db.query(CodeRegistry).filter(
            CodeRegistry.clean_code == raw_code
        ).first()
        
        if code_match:
            logger.debug(
                "code_match_found",
                extra={"code": code_match.clean_code}
            )
            return {
                "clean_code": code_match.clean_code,
                "confidence": 0.90,
                "source": "exact_code_match"
            }
        
        # Strategy 3: Fuzzy code match (similar codes)
        similar = self.db.query(CodeRegistry).filter(
            or_(
                CodeRegistry.clean_code.like(f"{raw_code[:5]}%"),
                CodeRegistry.alternate_codes.contains(raw_code)
            )
        ).first()
        
        if similar:
            logger.debug(
                "similar_code_found",
                extra={"code": similar.clean_code, "raw": raw_code}
            )
            return {
                "clean_code": similar.clean_code,
                "confidence": 0.75,
                "source": "fuzzy_match"
            }
        
        # Strategy 4: Auto-clean (no historical match)
        cleaned = self._auto_clean_code(raw_code)
        return {
            "clean_code": cleaned,
            "confidence": 0.65,
            "source": "auto_clean"
        }
    
    def _layer3_sanitize_code(
        self,
        code: str,
        brand: Optional[str],
        description: str
    ) -> str:
        """
        Layer 3: Sanitization.
        
        Remove brand/description from code if contained.
        """
        if not code:
            return "UNKNOWN"
        
        # Remove brand from code
        if brand and brand.lower() in code.lower():
            code = code.replace(brand, "").replace(brand.lower(), "")
        
        # Remove first word of description if it's in the code
        first_word = description.split()[0] if description else ""
        if first_word and len(first_word) > 3 and first_word.lower() in code.lower():
            code = code.replace(first_word, "").replace(first_word.lower(), "")
        
        # Clean up separators
        code = re.sub(r'^[-_\s.]+|[-_\s.]+$', '', code)
        code = re.sub(r'\s+', ' ', code)
        
        return code.strip().upper() or "UNKNOWN"
    
    def _extract_brand(self, raw_line: str) -> Optional[str]:
        """Extract brand from raw line using common patterns."""
        # Common brand patterns (customize based on your domain)
        brand_keywords = [
            "TOYOTA", "HONDA", "FORD", "CHEVROLET", "NISSAN",
            "MAZDA", "HYUNDAI", "KIA", "VOLKSWAGEN", "BMW"
        ]
        
        line_upper = raw_line.upper()
        for brand in brand_keywords:
            if brand in line_upper:
                return brand
        
        return None
    
    def _extract_code(
        self,
        raw_line: str,
        description: str,
        brand: Optional[str]
    ) -> str:
        """
        Extract product code from raw line.
        
        Prioritizes alphanumeric patterns that look like universal codes.
        """
        # Remove description and brand to isolate code
        line = raw_line
        if description:
            line = line.replace(description, "")
        if brand:
            line = line.replace(brand, "")
        
        # Pattern 1: Alphanumeric with dashes (e.g., 90915-YZZE1)
        pattern1 = r'\b([A-Z0-9]{3,}[-][A-Z0-9]{3,})\b'
        match = re.search(pattern1, line.upper())
        if match:
            return match.group(1)
        
        # Pattern 2: Alphanumeric without dashes (e.g., 15400RTA)
        pattern2 = r'\b([A-Z]{2,}[0-9]{3,}[A-Z]*)\b'
        match = re.search(pattern2, line.upper())
        if match:
            return match.group(1)
        
        # Pattern 3: Numeric with dashes (e.g., 123-456-789)
        pattern3 = r'\b([0-9]{2,}[-][0-9]{2,})\b'
        match = re.search(pattern3, line)
        if match:
            return match.group(1)
        
        # Fallback: First alphanumeric sequence
        pattern4 = r'\b([A-Z0-9]{4,})\b'
        match = re.search(pattern4, line.upper())
        if match:
            return match.group(1)
        
        return "UNKNOWN"
    
    def _auto_clean_code(self, raw_code: str) -> str:
        """Auto-clean a code with no historical match."""
        if not raw_code:
            return "UNKNOWN"
        
        # Remove common prefixes
        code = re.sub(r'^(REF|OEM|PART|SKU)[-:\s]*', '', raw_code, flags=re.IGNORECASE)
        
        # Normalize separators
        code = re.sub(r'[-_\s]+', '-', code)
        
        # Remove trailing/leading separators
        code = re.sub(r'^-+|-+$', '', code)
        
        return code.strip().upper() or "UNKNOWN"
    
    def _parse_price(self, price_text: str) -> Decimal:
        """Parse price from text."""
        if not price_text:
            return Decimal("0.00")
        
        # Remove currency symbols and spaces
        cleaned = re.sub(r'[^\d.,]', '', price_text)
        
        # Handle different decimal separators
        if ',' in cleaned and '.' in cleaned:
            # Assume European format: 1.234,56
            if cleaned.rfind(',') > cleaned.rfind('.'):
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                # US format: 1,234.56
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Could be either 1,234 or 12,34
            if len(cleaned.split(',')[1]) == 2:
                cleaned = cleaned.replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        
        try:
            return Decimal(cleaned)
        except:
            logger.warning(f"Failed to parse price: {price_text}")
            return Decimal("0.00")
    
    async def _update_code_registry(
        self,
        clean_code: str,
        description: str,
        brand: Optional[str]
    ) -> None:
        """Update or create code registry entry."""
        existing = self.db.query(CodeRegistry).filter(
            CodeRegistry.clean_code == clean_code
        ).first()
        
        if existing:
            existing.occurrence_count += 1
            existing.canonical_description = description
            existing.canonical_brand = brand
        else:
            registry_entry = CodeRegistry(
                clean_code=clean_code,
                canonical_description=description,
                canonical_brand=brand,
                occurrence_count=1,
                alternate_codes={"variants": []}
            )
            self.db.add(registry_entry)
