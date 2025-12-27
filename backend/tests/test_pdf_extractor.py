"""
Tests for PDF extractor.
"""
import pytest
from services.extractors.pdf_extractor import PDFExtractor
from services.extractors.base import RawProduct


class TestPDFExtractor:
    """Test PDF extractor functionality."""
    
    def test_supports_pdf(self):
        """Test that extractor supports PDF MIME type."""
        extractor = PDFExtractor()
        
        assert extractor.supports('application/pdf') is True
        assert extractor.supports('application/vnd.ms-excel') is False
    
    @pytest.mark.asyncio
    async def test_extract_simple_text(self):
        """Test extraction from simple text-based PDF."""
        extractor = PDFExtractor()
        
        # This is a minimal PDF structure (won't actually work with pdfplumber)
        # In real tests, you'd use actual PDF files
        # For now, we'll skip this test if pdfplumber is not available
        try:
            import pdfplumber
        except ImportError:
            pytest.skip("pdfplumber not installed")
        
        # Would need actual PDF content here
        # This is just a placeholder to show test structure
    
    def test_price_pattern_matching(self):
        """Test price pattern detection."""
        extractor = PDFExtractor()
        
        # Test various price formats
        assert extractor._find_price("Product $10.99") == "$10.99"
        assert extractor._find_price("Item 25.50") == "25.50"
        assert extractor._find_price("Price: USD 100.00") == "USD 100.00"
        assert extractor._find_price("No price here") is None
    
    def test_column_detection(self):
        """Test column detection from header."""
        extractor = PDFExtractor()
        
        header = ["Producto", "Precio", "Stock"]
        name_col, price_col = extractor._detect_columns(header)
        
        assert name_col == 0  # Producto
        assert price_col == 1  # Precio
    
    def test_clean_text(self):
        """Test text cleaning."""
        extractor = PDFExtractor()
        
        assert extractor._clean_text("  Multiple   spaces  ") == "Multiple spaces"
        assert extractor._clean_text(None) == ""
        assert extractor._clean_text("Normal text") == "Normal text"
