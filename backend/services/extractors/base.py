"""
Base extractor interface for file processing.

Implements the Strategy pattern for handling different file formats.
"""
from abc import ABC, abstractmethod
from typing import List
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class RawProduct:
    """
    Value Object for extracted product data.
    
    Supports both traditional price-based catalogs and flexible multi-column catalogs
    (e.g., automotive parts with brand/model/year/engine/part codes).
    
    Attributes:
        name: Product name (or primary identifier)
        price_text: Raw price text as extracted (empty string if no price)
        raw_line: Original line from source
        columns: Flexible key-value pairs for all extracted columns
        catalog_type: Type of catalog ("price_list", "automotive_parts", etc.)
    """
    name: str
    price_text: str
    raw_line: str
    columns: dict = None  # Dict[str, str] - flexible column data
    catalog_type: str = "price_list"
    
    def __post_init__(self):
        """Initialize columns dict if not provided."""
        if self.columns is None:
            self.columns = {}


class BaseExtractor(ABC):
    """
    Abstract base class for all file extractors.
    
    Implements Strategy pattern for different file formats.
    
    SOLID Principles Applied:
    - Single Responsibility: Only extracts data from one format
    - Open/Closed: New formats = new classes, don't modify existing
    - Liskov Substitution: All extractors are interchangeable
    - Interface Segregation: Minimal interface
    - Dependency Inversion: Depends on abstractions
    """
    
    @abstractmethod
    def supports(self, mime_type: str) -> bool:
        """
        Check if this extractor supports the given MIME type.
        
        Args:
            mime_type: MIME type to check
            
        Returns:
            bool: True if supported, False otherwise
        """
        pass
    
    @abstractmethod
    async def extract(self, content: bytes) -> List[RawProduct]:
        """
        Extract products from file content.
        
        Args:
            content: File content as bytes
            
        Returns:
            List[RawProduct]: Extracted products
            
        Raises:
            FileProcessingError: If extraction fails
        """
        pass
    
    def _log_extraction_start(self, file_size: int) -> None:
        """Log structured message at extraction start."""
        logger.info(
            "extraction_started",
            extra={
                "extractor": self.__class__.__name__,
                "file_size_bytes": file_size,
            }
        )
    
    def _log_extraction_complete(self, product_count: int) -> None:
        """Log structured message at extraction completion."""
        logger.info(
            "extraction_completed",
            extra={
                "extractor": self.__class__.__name__,
                "products_found": product_count,
            }
        )
