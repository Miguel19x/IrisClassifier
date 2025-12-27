"""
IrisClassifier FastAPI Application.

Main application entry point with middleware, routers, and configuration.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import get_settings
from core.logging_config import setup_logging, CorrelationMiddleware
from core.monitoring import setup_monitoring
from core.versioning import APIVersionMiddleware
from core.exceptions import IrisException
from database.models import Base
from database.connection import engine

# Initialize settings
settings = get_settings()

# Setup logging
setup_logging(level=settings.log_level, json_output=settings.json_logs)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    headers_enabled=True  # Enable rate limit headers
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("application_starting", extra={"version": "1.0.0"})
    
    # Create database tables (in production, use Alembic migrations)
    Base.metadata.create_all(bind=engine)
    
    logger.info("database_initialized")
    
    yield
    
    # Shutdown
    logger.info("application_shutting_down")
    engine.dispose()


# Create FastAPI application
app = FastAPI(
    title="IrisClassifier API",
    description="Product catalog classification API with AI-powered price range detection",
    version="1.0.0",
    lifespan=lifespan,
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CorrelationMiddleware)
app.add_middleware(
    APIVersionMiddleware,
    current_version="v1",
    latest_version="v1",
    is_deprecated=False
)

# Setup monitoring
setup_monitoring(app)


# Exception handlers
@app.exception_handler(IrisException)
async def iris_exception_handler(request: Request, exc: IrisException):
    """Handle custom application exceptions."""
    logger.error(
        "application_error",
        extra={
            "code": exc.code,
            "error_message": exc.message,
            "path": request.url.path,
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
            }
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(
        "unexpected_error",
        extra={
            "error_type": type(exc).__name__,
            "path": request.url.path,
        }
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            }
        }
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: Health status and version information.
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected",
        "ollama": "checking",
    }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint with API information.
    
    Returns:
        dict: API information and available endpoints.
    """
    return {
        "name": "IrisClassifier API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "metrics": "/metrics",
    }


# Include API routers
from api.v1.routers import catalogs, products, price_ranges, upload, export, auth, compare, mixed_listings

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(catalogs.router, prefix="/api/v1", tags=["Catalogs"])
app.include_router(products.router, prefix="/api/v1", tags=["Products"])
app.include_router(price_ranges.router, prefix="/api/v1", tags=["Price Ranges"])
app.include_router(upload.router, prefix="/api/v1", tags=["Upload"])
app.include_router(export.router, prefix="/api/v1", tags=["Export"])
app.include_router(compare.router, prefix="/api/v1", tags=["Comparison"])  # NEW
app.include_router(mixed_listings.router, prefix="/api/v1", tags=["Mixed Listings"])  # NEW


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
