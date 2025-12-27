"""
Integration tests for API endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self):
        """Test that health endpoint returns 200."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestRootEndpoint:
    """Test root endpoint."""
    
    def test_root(self):
        """Test that root endpoint returns API info."""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "IrisClassifier API"
        assert "docs" in data


class TestPriceRangesAPI:
    """Test price ranges endpoints."""
    
    def test_list_empty(self):
        """Test listing price ranges when empty."""
        response = client.get("/api/v1/price-ranges")
        
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_price_range(self):
        """Test creating a price range."""
        data = {
            "name": "Test Range",
            "min_price": 0,
            "max_price": 100,
            "color": "#FF0000",
            "display_order": 0
        }
        
        response = client.post("/api/v1/price-ranges", json=data)
        
        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Test Range"
        assert result["min_price"] == 0
        assert result["max_price"] == 100
    
    def test_create_invalid_range(self):
        """Test creating invalid price range (max < min)."""
        data = {
            "name": "Invalid Range",
            "min_price": 100,
            "max_price": 50,
            "color": "#FF0000",
            "display_order": 0
        }
        
        response = client.post("/api/v1/price-ranges", json=data)
        
        assert response.status_code == 400


class TestProductsAPI:
    """Test products endpoints."""
    
    def test_list_empty(self):
        """Test listing products when empty."""
        response = client.get("/api/v1/products")
        
        assert response.status_code == 200
        data = response.json()
        assert data["products"] == []
        assert data["total"] == 0
        assert data["page"] == 1


class TestCatalogsAPI:
    """Test catalogs endpoints."""
    
    def test_list_empty(self):
        """Test listing catalogs when empty."""
        response = client.get("/api/v1/catalogs")
        
        assert response.status_code == 200
        data = response.json()
        assert data["catalogs"] == []
        assert data["total"] == 0
