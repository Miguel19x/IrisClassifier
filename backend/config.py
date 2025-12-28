"""
Application configuration with performance tuning parameters.

All values can be overridden via environment variables.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Attributes:
        database_url: Database connection string.
        db_pool_size: Number of connections to keep in pool.
        db_max_overflow: Max additional connections beyond pool_size.
        ollama_url: Ollama API endpoint.
        ollama_timeout: Timeout for Ollama requests in seconds.
        ollama_model: Model to use for classification.
        cache_max_size: Maximum number of cached classification results.
        batch_size: Number of products to classify per batch.
        max_file_size_mb: Maximum upload file size in megabytes.
        rate_limit_per_minute: API rate limit per IP address.
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR).
    
    Example:
        >>> settings = get_settings()
        >>> print(settings.database_url)
        'sqlite:///./iris.db'
    """
    
    # Database
    database_url: str = "sqlite:///./iris.db"
    db_pool_size: int = 20
    db_max_overflow: int = 30
    db_pool_timeout: int = 30
    db_pool_recycle: int = 3600  # Recycle connections after 1 hour
    
    # Ollama AI
    ollama_url: str = "http://localhost:11434"
    ollama_timeout: int = 60
    ollama_model: str = "llama3.2"
    ollama_max_retries: int = 2
    
    # Gemini AI Vision
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"  # Supports native PDF processing
    gemini_timeout: int = 120  # Increased for large PDFs
    
    # Gemini Rate Limiting (Conservative for free tier)
    gemini_requests_per_minute: int = 10  # ~15 RPM free tier, use 10 to be safe
    gemini_page_batch_size: int = 5       # Pages per batch for PDF processing
    gemini_retry_max_attempts: int = 3    # Max retry attempts on 429 errors
    gemini_retry_base_delay: float = 2.0  # Base delay in seconds for exponential backoff
    
    # Caching
    cache_max_size: int = 2000
    cache_ttl_seconds: int = 3600  # 1 hour
    
    # Processing
    batch_size: int = 20
    max_file_size_mb: int = 100
    max_products_per_catalog: int = 10000
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    rate_limit_per_minute: int = 60
    rate_limit_upload_per_minute: int = 10
    
    # Logging
    log_level: str = "INFO"
    json_logs: bool = True
    
    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:8100,capacitor://localhost,http://localhost"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached application settings.
    
    Uses LRU cache to avoid re-reading environment variables
    on every access. Cache is cleared when the application restarts.
    
    Returns:
        Settings: Application configuration object.
    """
    return Settings()
