"""
Tests for cache service.
"""
import pytest
import time
from services.cache_service import LRUCache, generate_cache_key


class TestLRUCache:
    """Test LRU cache functionality."""
    
    def test_set_and_get(self):
        """Test basic set and get operations."""
        cache = LRUCache[str](max_size=10, ttl_seconds=60)
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
    
    def test_get_nonexistent(self):
        """Test getting a key that doesn't exist."""
        cache = LRUCache[str](max_size=10, ttl_seconds=60)
        
        assert cache.get("nonexistent") is None
    
    def test_lru_eviction(self):
        """Test that LRU eviction works correctly."""
        cache = LRUCache[str](max_size=3, ttl_seconds=60)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        
        # Access key1 to make it recently used
        cache.get("key1")
        
        # Add key4, should evict key2 (least recently used)
        cache.set("key4", "value4")
        
        assert cache.get("key1") == "value1"  # Still there
        assert cache.get("key2") is None      # Evicted
        assert cache.get("key3") == "value3"  # Still there
        assert cache.get("key4") == "value4"  # New entry
    
    def test_ttl_expiration(self):
        """Test that entries expire after TTL."""
        cache = LRUCache[str](max_size=10, ttl_seconds=1)
        
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        # Wait for expiration
        time.sleep(1.1)
        
        assert cache.get("key1") is None
    
    def test_invalidate(self):
        """Test cache invalidation."""
        cache = LRUCache[str](max_size=10, ttl_seconds=60)
        
        cache.set("key1", "value1")
        assert cache.invalidate("key1") is True
        assert cache.get("key1") is None
        assert cache.invalidate("key1") is False  # Already removed
    
    def test_clear(self):
        """Test clearing the cache."""
        cache = LRUCache[str](max_size=10, ttl_seconds=60)
        
        cache.set("key1", "value1")
        cache.set("key2", "value2")
        
        count = cache.clear()
        assert count == 2
        assert cache.get("key1") is None
        assert cache.get("key2") is None
    
    def test_stats(self):
        """Test cache statistics."""
        cache = LRUCache[str](max_size=10, ttl_seconds=60)
        
        cache.set("key1", "value1")
        cache.get("key1")  # Hit
        cache.get("key2")  # Miss
        
        stats = cache.get_stats()
        assert stats["size"] == 1
        assert stats["max_size"] == 10
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5


class TestCacheKeyGeneration:
    """Test cache key generation."""
    
    def test_deterministic(self):
        """Test that same inputs produce same key."""
        key1 = generate_cache_key("product", 123, ["range1", "range2"])
        key2 = generate_cache_key("product", 123, ["range1", "range2"])
        
        assert key1 == key2
    
    def test_different_inputs(self):
        """Test that different inputs produce different keys."""
        key1 = generate_cache_key("product", 123)
        key2 = generate_cache_key("product", 456)
        
        assert key1 != key2
    
    def test_order_matters(self):
        """Test that argument order matters."""
        key1 = generate_cache_key("a", "b")
        key2 = generate_cache_key("b", "a")
        
        assert key1 != key2
