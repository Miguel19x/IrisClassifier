"""
Production monitoring with Prometheus metrics.

Exposes application metrics for Grafana dashboards and alerts.
"""
import time
import logging
from typing import Callable
from functools import wraps

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
)
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Application info
APP_INFO = Info('iris_app', 'Application information')
APP_INFO.info({
    'version': '1.0.0',
    'python_version': '3.11',
    'framework': 'fastapi',
})

# Request metrics
REQUEST_COUNT = Counter(
    'iris_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_LATENCY = Histogram(
    'iris_http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Business metrics
CATALOGS_PROCESSED = Counter(
    'iris_catalogs_processed_total',
    'Total catalogs processed',
    ['status']  # 'success', 'failed'
)

PRODUCTS_CLASSIFIED = Counter(
    'iris_products_classified_total',
    'Total products classified',
    ['method']  # 'ai', 'fallback', 'manual'
)

CLASSIFICATION_LATENCY = Histogram(
    'iris_classification_duration_seconds',
    'Time to classify a batch of products',
    ['method'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

# System metrics
ACTIVE_USERS = Gauge(
    'iris_active_users',
    'Number of active users in the last 5 minutes'
)

CACHE_HIT_RATE = Gauge(
    'iris_cache_hit_rate',
    'Cache hit rate percentage'
)

DB_POOL_SIZE = Gauge(
    'iris_db_pool_size',
    'Database connection pool size',
    ['status']  # 'active', 'idle', 'overflow'
)

OLLAMA_AVAILABILITY = Gauge(
    'iris_ollama_available',
    'Whether Ollama service is available (1 = yes, 0 = no)'
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Middleware to collect HTTP request metrics.
    
    Records request count, latency, and status codes for
    all API endpoints.
    """
    
    async def dispatch(self, request: Request, call_next: Callable):
        # Skip metrics endpoint to avoid recursion
        if request.url.path == '/metrics':
            return await call_next(request)
        
        method = request.method
        # Normalize path to avoid high cardinality
        endpoint = self._normalize_path(request.url.path)
        
        start_time = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start_time
        
        # Record metrics
        REQUEST_COUNT.labels(
            method=method,
            endpoint=endpoint,
            status_code=response.status_code
        ).inc()
        
        REQUEST_LATENCY.labels(
            method=method,
            endpoint=endpoint
        ).observe(duration)
        
        return response
    
    def _normalize_path(self, path: str) -> str:
        """
        Normalize URL path to reduce cardinality.
        
        Replaces dynamic segments like IDs with placeholders.
        Example: /api/v1/products/123 -> /api/v1/products/{id}
        """
        parts = path.split('/')
        normalized = []
        for part in parts:
            if part.isdigit():
                normalized.append('{id}')
            elif len(part) == 36 and '-' in part:  # UUID
                normalized.append('{uuid}')
            else:
                normalized.append(part)
        return '/'.join(normalized)


def setup_monitoring(app: FastAPI) -> None:
    """
    Configure monitoring for the FastAPI application.
    
    Adds Prometheus middleware and /metrics endpoint.
    
    Args:
        app: FastAPI application instance.
    
    Example:
        >>> from fastapi import FastAPI
        >>> app = FastAPI()
        >>> setup_monitoring(app)
    """
    # Add middleware
    app.add_middleware(PrometheusMiddleware)
    
    # Add metrics endpoint
    @app.get('/metrics', include_in_schema=False)
    async def metrics():
        """Prometheus metrics endpoint."""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )
    
    logger.info("monitoring_configured", extra={"endpoint": "/metrics"})


def track_classification(method: str):
    """
    Decorator to track classification metrics.
    
    Records the classification method and duration.
    
    Args:
        method: Classification method ('ai', 'fallback', 'manual').
    
    Example:
        >>> @track_classification('ai')
        >>> async def classify_with_ai(products):
        ...     return await ollama.classify(products)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                PRODUCTS_CLASSIFIED.labels(method=method).inc(len(result))
                return result
            finally:
                duration = time.perf_counter() - start_time
                CLASSIFICATION_LATENCY.labels(method=method).observe(duration)
        return wrapper
    return decorator
