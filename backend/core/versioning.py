"""
API versioning middleware.

Adds version-related headers to all API responses.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class APIVersionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add API version headers to responses.
    
    Adds the following headers:
    - X-API-Version: Current API version
    - X-API-Deprecated: Whether this version is deprecated
    - X-API-Latest-Version: Latest available API version
    - X-API-Migration-Guide: URL to migration guide (if deprecated)
    """
    
    def __init__(
        self,
        app,
        current_version: str = "v1",
        latest_version: str = "v1",
        is_deprecated: bool = False,
        migration_guide_url: str = None
    ):
        super().__init__(app)
        self.current_version = current_version
        self.latest_version = latest_version
        self.is_deprecated = is_deprecated
        self.migration_guide_url = migration_guide_url
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Add version headers
        response.headers["X-API-Version"] = self.current_version
        response.headers["X-API-Latest-Version"] = self.latest_version
        response.headers["X-API-Deprecated"] = str(self.is_deprecated).lower()
        
        # Add migration guide if deprecated
        if self.is_deprecated and self.migration_guide_url:
            response.headers["X-API-Migration-Guide"] = self.migration_guide_url
        
        return response
