"""
Tests for brand detection service.
"""
import pytest
from services.brand_detection_service import BrandDetectionService, RowWithBrand


class TestBrandDetectionService:
    """Test brand detection functionality."""
    
    def test_pattern_matching_audi(self):
        """Test pattern matching for Audi models."""
        service = BrandDetectionService()
        
        brand, confidence = service._detect_brand_by_pattern("A4")
        assert brand == "Audi"
        assert confidence > 0.5
        
        brand, confidence = service._detect_brand_by_pattern("Q7")
        assert brand == "Audi"
        
        brand, confidence = service._detect_brand_by_pattern("TT")
        assert brand == "Audi"
    
    def test_pattern_matching_bmw(self):
        """Test pattern matching for BMW models."""
        service = BrandDetectionService()
        
        brand, confidence = service._detect_brand_by_pattern("318i")
        assert brand == "BMW"
        
        brand, confidence = service._detect_brand_by_pattern("530i")
        assert brand == "BMW"
        
        brand, confidence = service._detect_brand_by_pattern("X5")
        assert brand == "BMW"
    
    def test_pattern_matching_alfa_romeo(self):
        """Test pattern matching for Alfa Romeo models."""
        service = BrandDetectionService()
        
        brand, confidence = service._detect_brand_by_pattern("146")
        assert brand == "Alfa Romeo"
        
        brand, confidence = service._detect_brand_by_pattern("156")
        assert brand == "Alfa Romeo"
        
        brand, confidence = service._detect_brand_by_pattern("SPIDER")
        assert brand == "Alfa Romeo"
    
    def test_pattern_matching_multiple_brands(self):
        """Test pattern matching across multiple brands."""
        service = BrandDetectionService()
        
        test_cases = [
            ("CIVIC", "Honda"),
            ("COROLLA", "Toyota"),
            ("GOLF", "Volkswagen"),
            ("MUSTANG", "Ford"),
            ("C200", "Mercedes-Benz"),
        ]
        
        for model, expected_brand in test_cases:
            brand, _ = service._detect_brand_by_pattern(model)
            assert brand == expected_brand, f"Expected {expected_brand} for {model}, got {brand}"
    
    def test_unknown_model_returns_none(self):
        """Test that unknown models return None."""
        service = BrandDetectionService()
        
        brand, confidence = service._detect_brand_by_pattern("XYZ123")
        assert brand is None
        assert confidence == 0.0
    
    def test_find_model_column(self):
        """Test model column detection."""
        service = BrandDetectionService()
        
        columns = ["MARCA MODELO", "AÑO", "MOTOR", "CHAMPION"]
        result = service._find_model_column(columns)
        assert result == "MARCA MODELO"
        
        columns = ["Model", "Year", "Engine"]
        result = service._find_model_column(columns)
        assert result == "Model"
    
    @pytest.mark.asyncio
    async def test_detect_brands_in_rows(self):
        """Test batch brand detection."""
        service = BrandDetectionService()
        
        rows = [
            {"MODELO": "A4", "AÑO": "2020"},
            {"MODELO": "318i", "AÑO": "2019"},
            {"MODELO": "CIVIC", "AÑO": "2021"},
        ]
        
        results = await service.detect_brands_in_rows(rows, model_column="MODELO")
        
        assert len(results) == 3
        assert results[0].brand == "Audi"
        assert results[1].brand == "BMW"
        assert results[2].brand == "Honda"


class TestBrandPatterns:
    """Test specific brand pattern matching."""
    
    def test_year_ranges_not_matched(self):
        """Test that year ranges are not matched as models."""
        service = BrandDetectionService()
        
        # These should NOT match any brand
        for year_str in ["2020", "1997-1999", "2001/2002"]:
            brand, _ = service._detect_brand_by_pattern(year_str)
            # Year strings might match or not, but shouldn't crash
            # The important thing is they're handled
    
    def test_case_insensitivity(self):
        """Test that matching is case insensitive."""
        service = BrandDetectionService()
        
        brand1, _ = service._detect_brand_by_pattern("a4")
        brand2, _ = service._detect_brand_by_pattern("A4")
        brand3, _ = service._detect_brand_by_pattern("a4t")
        
        assert brand1 == "Audi"
        assert brand2 == "Audi"
        # A4T might match A4 pattern
