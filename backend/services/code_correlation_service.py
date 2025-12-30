"""
Code Correlation Service for Intelligent Column Detection.

Uses historical data (CodeRegistry, BrandRegistry) to:
1. Identify the correct product code column
2. Detect and separate brands from code cells
3. Store distributor codes for future correlation
"""
import logging
import re
from typing import Dict, List, Optional, Set, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models import CodeRegistry, BrandRegistry, DistributorCodeRegistry

logger = logging.getLogger(__name__)

# Manual list of known automotive brands (frequently encountered)
KNOWN_BRANDS = [
    # Major automotive brands
    "TOYOTA", "HONDA", "FORD", "CHEVROLET", "NISSAN", "MAZDA", "HYUNDAI", "KIA",
    "VOLKSWAGEN", "BMW", "MERCEDES", "AUDI", "LEXUS", "ACURA", "MITSUBISHI",
    "SUBARU", "SUZUKI", "ISUZU", "JEEP", "DODGE", "CHRYSLER", "GMC", "BUICK",
    "CADILLAC", "LINCOLN", "INFINITI", "VOLVO", "JAGUAR", "LAND ROVER", "PORSCHE",
    "FIAT", "ALFA ROMEO", "PEUGEOT", "RENAULT", "CITROEN", "SEAT", "SKODA",
    # Chinese brands
    "CHERY", "GEELY", "BYD", "GREAT WALL", "HAVAL", "JAC", "CHANGAN", "DONGFENG",
    "FOTON", "LIFAN", "MG", "SAIC", "FAW", "BAIC",
    # Parts manufacturers
    "DENSO", "BOSCH", "NGK", "DELPHI", "VALEO", "SACHS", "LUK", "AISIN",
    "KOYO", "NTN", "NSK", "SKF", "TIMKEN", "GATES", "DAYCO", "CONTINENTAL",
    "MAHLE", "MANN", "HENGST", "FRAM", "MOTORCRAFT", "ACDelco", "MOPAR",
    "MOOG", "TRW", "BREMBO", "ATE", "FERODO", "TEXTAR", "PAGID", "JURID",
    # Aftermarket brands
    "PRO WIRE", "PROWIRE", "MOTTA", "TW", "RM", "GP", "FENIX", "BRONCO",
    "ULTRA", "QUALITY", "PREMIUM", "ORIGINAL", "OEM", "GENERIC",
    # Electrical
    "DELCO", "REMY", "HITACHI", "MITSUBISHI ELECTRIC", "MARELLI", "MAGNETI",
    "WAI", "WILSON", "BBB INDUSTRIES", "ARROWHEAD",
]


class CodeCorrelationService:
    """
    Service for intelligent code correlation and column detection.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._known_codes: Optional[Set[str]] = None
        self._known_brands: Optional[Set[str]] = None
        
    def get_known_codes(self, limit: int = 50000) -> Set[str]:
        """
        Get all known product codes from CodeRegistry.
        Cached for performance.
        """
        if self._known_codes is None:
            codes = self.db.query(CodeRegistry.clean_code).limit(limit).all()
            self._known_codes = {code[0].upper() for code in codes if code[0]}
            logger.info(f"Loaded {len(self._known_codes)} known codes from registry")
        return self._known_codes
    
    def get_known_brands(self) -> Set[str]:
        """
        Get all known brands from BrandRegistry + manual list.
        Cached for performance.
        """
        if self._known_brands is None:
            # Start with manual brands
            self._known_brands = {b.upper() for b in KNOWN_BRANDS}
            
            # Add auto-learned brands from registry
            db_brands = self.db.query(BrandRegistry.normalized_name).filter(
                BrandRegistry.is_active == True
            ).all()
            self._known_brands.update({b[0] for b in db_brands if b[0]})
            
            logger.info(f"Loaded {len(self._known_brands)} known brands")
        return self._known_brands
    
    def analyze_columns_for_codes(
        self, 
        df, 
        sample_size: int = 100
    ) -> Dict[str, int]:
        """
        Analyze DataFrame columns to find which contains known product codes.
        
        Returns dict of column_name -> match_count, sorted by matches descending.
        """
        known_codes = self.get_known_codes()
        if not known_codes:
            logger.warning("No known codes in registry, skipping column correlation")
            return {}
        
        # Sample rows for efficiency
        sample_df = df.head(sample_size)
        
        column_scores = {}
        for col in df.columns:
            matches = 0
            for val in sample_df[col].dropna():
                val_str = str(val).strip().upper()
                # Remove common separators for matching
                val_normalized = re.sub(r'[-\s]', '', val_str)
                
                if val_str in known_codes or val_normalized in known_codes:
                    matches += 1
            
            if matches > 0:
                column_scores[col] = matches
        
        # Sort by matches descending
        sorted_scores = dict(sorted(column_scores.items(), key=lambda x: x[1], reverse=True))
        
        if sorted_scores:
            best_col = next(iter(sorted_scores))
            logger.info(
                "column_correlation_analysis",
                extra={
                    "best_column": str(best_col),
                    "matches": sorted_scores[best_col],
                    "all_scores": sorted_scores
                }
            )
        
        return sorted_scores
    
    def separate_brand_from_code(
        self, 
        value: str
    ) -> Tuple[str, Optional[str]]:
        """
        Separate brand from code if combined in same cell.
        
        Examples:
            "B11-3701110BB CHERY" -> ("B11-3701110BB", "CHERY")
            "PRO WIRE 22583" -> ("22583", "PRO WIRE")
            "13575N" -> ("13575N", None)
        """
        if not value:
            return (value, None)
        
        known_brands = self.get_known_brands()
        value_upper = value.upper().strip()
        
        # Strategy 1: Check if value ends with a known brand
        for brand in sorted(known_brands, key=len, reverse=True):  # Longest first
            if value_upper.endswith(' ' + brand):
                code = value[:-len(brand)-1].strip()
                return (code, brand)
        
        # Strategy 2: Check if value starts with a known brand
        for brand in sorted(known_brands, key=len, reverse=True):
            if value_upper.startswith(brand + ' '):
                code = value[len(brand)+1:].strip()
                return (code, brand)
        
        # Strategy 3: Check if brand is contained (with word boundaries)
        for brand in sorted(known_brands, key=len, reverse=True):
            pattern = r'\b' + re.escape(brand) + r'\b'
            if re.search(pattern, value_upper):
                code = re.sub(pattern, '', value_upper).strip()
                code = re.sub(r'\s+', ' ', code).strip()
                return (code, brand)
        
        return (value, None)
    
    def learn_brand(self, brand: str) -> None:
        """
        Add a new brand to the registry if not already known.
        """
        if not brand or len(brand) < 2:
            return
        
        normalized = brand.upper().strip()
        
        # Check if already exists
        existing = self.db.query(BrandRegistry).filter(
            BrandRegistry.normalized_name == normalized
        ).first()
        
        if existing:
            existing.occurrence_count += 1
        else:
            # Only learn if it looks like a brand (not too long, not numeric)
            if len(normalized) <= 50 and not normalized.isdigit():
                new_brand = BrandRegistry(
                    brand_name=brand.strip(),
                    normalized_name=normalized,
                    source="auto_learned",
                    occurrence_count=1
                )
                self.db.add(new_brand)
                logger.info(f"Learned new brand: {brand}")
                
                # Clear cache
                self._known_brands = None
    
    def register_distributor_code(
        self, 
        distributor_code: str, 
        product_code: str,
        list_name: Optional[str] = None,
        list_id: Optional[int] = None
    ) -> None:
        """
        Register a mapping between distributor code and product code.
        """
        if not distributor_code or not product_code:
            return
        
        # Infer distributor name from list name
        distributor_name = None
        if list_name:
            # Try to extract distributor name (e.g., "LISTA DM" -> "DM")
            match = re.search(r'LISTA\s+(.+?)(?:\s+\d|$)', list_name.upper())
            if match:
                distributor_name = match.group(1).strip()
        
        # Check if mapping exists
        existing = self.db.query(DistributorCodeRegistry).filter(
            DistributorCodeRegistry.distributor_code == distributor_code.upper(),
            DistributorCodeRegistry.product_code == product_code.upper()
        ).first()
        
        if existing:
            existing.occurrence_count += 1
        else:
            new_mapping = DistributorCodeRegistry(
                distributor_code=distributor_code.upper(),
                product_code=product_code.upper(),
                distributor_name=distributor_name,
                source_list_id=list_id,
                occurrence_count=1
            )
            self.db.add(new_mapping)
    
    def find_product_code_by_distributor(self, distributor_code: str) -> Optional[str]:
        """
        Look up product code by distributor code.
        """
        if not distributor_code:
            return None
        
        result = self.db.query(DistributorCodeRegistry).filter(
            DistributorCodeRegistry.distributor_code == distributor_code.upper()
        ).order_by(DistributorCodeRegistry.occurrence_count.desc()).first()
        
        if result:
            return result.product_code
        return None
