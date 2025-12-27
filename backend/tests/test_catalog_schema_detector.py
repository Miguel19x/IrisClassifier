"""
Tests for catalog schema detector.
"""
import pytest
from services.catalog_schema_detector import (
    CatalogSchemaDetector,
    CatalogType,
    ColumnDefinition,
)


class TestCatalogSchemaDetector:
    """Test catalog schema detection functionality."""
    
    def test_detects_automotive_catalog(self):
        """Test detection of automotive parts catalog."""
        detector = CatalogSchemaDetector()
        
        # Automotive catalog headers
        headers = ["MARCA MODELO", "AÑO", "MOTOR", "CHAMPION", "NGK", "DENSO"]
        sample_rows = [
            ["146", "1997-1999", "2.0L", "RC9YCN4", "BKR6EKPA", "K20PR-U11"],
            ["156", "2001-2002", "2.0L", "RN9YC", "PFR6B", "K20TT"],
        ]
        
        schema = detector.detect(headers, sample_rows)
        
        assert schema.schema_type == CatalogType.AUTOMOTIVE_PARTS
        assert schema.confidence > 0.7
        assert len(schema.brand_columns) >= 2  # At least CHAMPION and NGK
        assert schema.key_column is not None
    
    def test_detects_price_list_catalog(self):
        """Test detection of traditional price list catalog."""
        detector = CatalogSchemaDetector()
        
        # Price list headers
        headers = ["Producto", "Precio", "Stock"]
        sample_rows = [
            ["Mouse Inalámbrico", "$29.99", "50"],
            ["Teclado Mecánico", "$89.99", "25"],
        ]
        
        schema = detector.detect(headers, sample_rows)
        
        assert schema.schema_type == CatalogType.PRICE_LIST
        assert schema.confidence > 0.6
    
    def test_detects_year_column_from_data(self):
        """Test that year column is detected from data patterns."""
        detector = CatalogSchemaDetector()
        
        headers = ["Model", "Years", "Engine"]
        sample_rows = [
            ["Civic", "2015-2020", "1.5T"],
            ["Accord", "2018-2023", "2.0T"],
        ]
        
        schema = detector.detect(headers, sample_rows)
        
        # Should detect automotive pattern from year ranges
        assert schema.schema_type == CatalogType.AUTOMOTIVE_PARTS
    
    def test_detects_price_from_currency_symbols(self):
        """Test that price columns are detected from currency symbols."""
        detector = CatalogSchemaDetector()
        
        headers = ["Item", "Cost", "Qty"]
        sample_rows = [
            ["Product A", "$15.99", "10"],
            ["Product B", "$25.50", "5"],
        ]
        
        schema = detector.detect(headers, sample_rows)
        
        assert schema.schema_type == CatalogType.PRICE_LIST
        assert schema.confidence > 0.5
    
    def test_handles_empty_headers(self):
        """Test handling of empty or None headers."""
        detector = CatalogSchemaDetector()
        
        headers = ["", None, "Data"]
        schema = detector.detect(headers)
        
        # Should not crash
        assert schema is not None
        assert len(schema.columns) == 3
    
    def test_clean_header_normalization(self):
        """Test header cleaning and normalization."""
        detector = CatalogSchemaDetector()
        
        # Headers with extra whitespace and special chars
        dirty_header = "  Product   Name!@#  "
        clean = detector._clean_header(dirty_header)
        
        assert clean == "Product Name"
        assert "!" not in clean
        assert "@" not in clean
