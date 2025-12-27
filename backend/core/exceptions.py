"""
Custom exception classes for IrisClassifier.

All application exceptions inherit from IrisException for
consistent error handling and logging.
"""


class IrisException(Exception):
    """
    Base exception for all application errors.
    
    Attributes:
        message: Human-readable error message
        code: Machine-readable error code
        status_code: HTTP status code
    """
    
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(self.message)


class FileProcessingError(IrisException):
    """Error processing uploaded file."""
    
    def __init__(self, message: str = "Error processing file"):
        super().__init__(
            message=message,
            code="FILE_PROCESSING_ERROR",
            status_code=422
        )


class AIServiceUnavailable(IrisException):
    """Ollama AI service is unavailable."""
    
    def __init__(self, message: str = "AI service unavailable, using fallback"):
        super().__init__(
            message=message,
            code="AI_SERVICE_UNAVAILABLE",
            status_code=503
        )


class InvalidPriceFormat(IrisException):
    """Price format not recognized."""
    
    def __init__(self, message: str = "Invalid price format"):
        super().__init__(
            message=message,
            code="INVALID_PRICE_FORMAT",
            status_code=422
        )


class CatalogTooLarge(IrisException):
    """Catalog exceeds maximum product limit."""
    
    def __init__(self, message: str = "Catalog exceeds maximum product limit"):
        super().__init__(
            message=message,
            code="CATALOG_TOO_LARGE",
            status_code=413
        )


class ValidationError(IrisException):
    """Request validation error."""
    
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            code="VALIDATION_ERROR",
            status_code=400
        )
        self.details = details or {}


class NotFoundError(IrisException):
    """Resource not found."""
    
    def __init__(self, resource: str, resource_id: int):
        super().__init__(
            message=f"{resource} with ID {resource_id} not found",
            code="NOT_FOUND",
            status_code=404
        )


class UnauthorizedError(IrisException):
    """Authentication required."""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            code="UNAUTHORIZED",
            status_code=401
        )


class ForbiddenError(IrisException):
    """Insufficient permissions."""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            code="FORBIDDEN",
            status_code=403
        )


class RateLimitExceeded(IrisException):
    """Rate limit exceeded."""
    
    def __init__(self, message: str = "Too many requests"):
        super().__init__(
            message=message,
            code="RATE_LIMITED",
            status_code=429
        )
