"""
Rate limiter for Gemini API requests.

Implements token bucket algorithm to prevent exceeding API rate limits
and includes retry logic with exponential backoff for 429 errors.
"""
import asyncio
import time
import logging
from typing import Callable, Any, TypeVar, Optional
from functools import wraps

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

T = TypeVar('T')


class GeminiRateLimiter:
    """
    Rate limiter using token bucket algorithm.
    
    Ensures requests don't exceed the configured requests per minute.
    Automatically waits before making requests if necessary.
    """
    
    def __init__(self, requests_per_minute: Optional[int] = None):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_minute: Maximum requests per minute (defaults to config)
        """
        self.requests_per_minute = requests_per_minute or settings.gemini_requests_per_minute
        self.min_interval = 60.0 / self.requests_per_minute  # Seconds between requests
        self.last_request_time = 0.0
        self._lock = asyncio.Lock()
        
        logger.info(
            "gemini_rate_limiter_initialized",
            extra={
                "requests_per_minute": self.requests_per_minute,
                "min_interval_seconds": self.min_interval
            }
        )
    
    async def acquire(self) -> None:
        """
        Acquire permission to make a request.
        
        Waits if necessary to respect rate limits.
        """
        async with self._lock:
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            
            if time_since_last < self.min_interval:
                wait_time = self.min_interval - time_since_last
                logger.debug(
                    "gemini_rate_limit_waiting",
                    extra={"wait_seconds": round(wait_time, 2)}
                )
                await asyncio.sleep(wait_time)
            
            self.last_request_time = time.time()
    
    async def execute_with_retry(
        self,
        func: Callable[..., T],
        *args,
        **kwargs
    ) -> T:
        """
        Execute a function with automatic retry on rate limit errors.
        
        Args:
            func: Async function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func
            
        Returns:
            Result from func
            
        Raises:
            Exception: If all retry attempts fail
        """
        max_attempts = settings.gemini_retry_max_attempts
        base_delay = settings.gemini_retry_base_delay
        
        for attempt in range(1, max_attempts + 1):
            try:
                # Wait for rate limit permission
                await self.acquire()
                
                # Execute the function
                result = await func(*args, **kwargs)
                
                if attempt > 1:
                    logger.info(
                        "gemini_retry_succeeded",
                        extra={"attempt": attempt}
                    )
                
                return result
                
            except Exception as e:
                error_msg = str(e).lower()
                is_rate_limit = (
                    "429" in error_msg or 
                    "too many requests" in error_msg or
                    "rate limit" in error_msg or
                    "quota" in error_msg
                )
                
                if is_rate_limit and attempt < max_attempts:
                    # Exponential backoff: 2s, 4s, 8s, etc.
                    delay = base_delay * (2 ** (attempt - 1))
                    
                    logger.warning(
                        "gemini_rate_limit_error_retrying",
                        extra={
                            "attempt": attempt,
                            "max_attempts": max_attempts,
                            "retry_delay_seconds": delay,
                            "error": str(e)
                        }
                    )
                    
                    await asyncio.sleep(delay)
                    continue
                
                # Not a rate limit error or out of retries
                if attempt == max_attempts:
                    logger.error(
                        "gemini_request_failed_all_retries",
                        extra={
                            "attempts": max_attempts,
                            "error": str(e)
                        }
                    )
                
                raise


# Singleton instance
_rate_limiter: Optional[GeminiRateLimiter] = None


def get_rate_limiter() -> GeminiRateLimiter:
    """Get or create the Gemini rate limiter singleton."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = GeminiRateLimiter()
    return _rate_limiter
