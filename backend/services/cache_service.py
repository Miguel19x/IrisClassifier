"""
LRU cache service for classification results.

Provides in-memory caching with LRU eviction policy.
"""
import hashlib
import json
import logging
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Generic, Optional, TypeVar
from threading import Lock

logger = logging.getLogger(__name__)

T = TypeVar('T')


@dataclass
class CacheEntry(Generic[T]):
    """
    Cache entry with value and metadata.
    
    Attributes:
        value: The cached value
        created_at: When the entry was created
        ttl_seconds: Time to live in seconds
        hit_count: Number of times accessed
    """
    value: T
    created_at: datetime
    ttl_seconds: int
    hit_count: int = 0
    
    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        expiry = self.created_at + timedelta(seconds=self.ttl_seconds)
        return datetime.utcnow() > expiry


class LRUCache(Generic[T]):
    """
    Thread-safe LRU (Least Recently Used) cache implementation.
    
    Uses OrderedDict for O(1) access and automatic LRU eviction.
    Supports TTL (time-to-live) for automatic expiration.
    
    Example:
        >>> cache = LRUCache[str](max_size=1000, ttl_seconds=3600)
        >>> cache.set("key1", "value1")
        >>> cache.get("key1")
        'value1'
    """
    
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        """
        Initialize the LRU cache.
        
        Args:
            max_size: Maximum number of entries
            ttl_seconds: Default time-to-live for entries
        """
        if max_size < 1:
            raise ValueError("max_size must be at least 1")
        
        self._cache: OrderedDict[str, CacheEntry[T]] = OrderedDict()
        self._max_size = max_size
        self._ttl_seconds = ttl_seconds
        self._lock = Lock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[T]:
        """
        Get a value from the cache.
        
        Moves the entry to the end (most recently used) on access.
        Returns None if key doesn't exist or entry is expired.
        """
        with self._lock:
            entry = self._cache.get(key)
            
            if entry is None:
                self._misses += 1
                return None
            
            if entry.is_expired():
                del self._cache[key]
                self._misses += 1
                logger.debug("cache_expired", extra={"key": key})
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            entry.hit_count += 1
            self._hits += 1
            
            return entry.value
    
    def set(self, key: str, value: T, ttl_seconds: Optional[int] = None) -> None:
        """
        Set a value in the cache.
        
        If the cache is full, evicts the least recently used entry.
        """
        with self._lock:
            # Remove if exists to update position
            if key in self._cache:
                del self._cache[key]
            
            # Evict LRU entries if at capacity
            while len(self._cache) >= self._max_size:
                evicted_key, _ = self._cache.popitem(last=False)
                logger.debug("cache_evicted", extra={"key": evicted_key})
            
            # Add new entry
            self._cache[key] = CacheEntry(
                value=value,
                created_at=datetime.utcnow(),
                ttl_seconds=ttl_seconds or self._ttl_seconds
            )
    
    def invalidate(self, key: str) -> bool:
        """Remove a specific key from the cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug("cache_invalidated", extra={"key": key})
                return True
            return False
    
    def clear(self) -> int:
        """Clear all entries from the cache."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            logger.info("cache_cleared", extra={"entries_cleared": count})
            return count
    
    def get_stats(self) -> dict:
        """Get cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = self._hits / total if total > 0 else 0.0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": round(hit_rate, 3),
            }


def generate_cache_key(*args: Any) -> str:
    """
    Generate a deterministic cache key from arguments.
    
    Uses MD5 hash for consistent, short keys.
    
    Example:
        >>> generate_cache_key("product", 123, ["range1", "range2"])
        'a1b2c3d4e5f6...'
    """
    content = json.dumps(args, sort_keys=True, default=str)
    return hashlib.md5(content.encode()).hexdigest()
