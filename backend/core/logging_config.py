"""
Production-ready structured logging configuration.

Supports correlation IDs for request tracing and log aggregation.
"""
import logging
import json
import sys
import uuid
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Dict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Context variable for request correlation
correlation_id: ContextVar[str] = ContextVar('correlation_id', default='-')


class StructuredFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    
    Outputs logs in JSON format suitable for log aggregation
    systems like Loki, ELK, or CloudWatch Logs.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": correlation_id.get(),
        }
        
        # Add extra fields
        if hasattr(record, '__dict__'):
            for key, value in record.__dict__.items():
                if key not in (
                    'name', 'msg', 'args', 'levelname', 'levelno',
                    'pathname', 'filename', 'module', 'lineno',
                    'funcName', 'created', 'msecs', 'relativeCreated',
                    'thread', 'threadName', 'processName', 'process',
                    'message', 'exc_info', 'exc_text', 'stack_info'
                ):
                    log_entry[key] = value
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add source location for errors
        if record.levelno >= logging.ERROR:
            log_entry["source"] = {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            }
        
        return json.dumps(log_entry, default=str)


class CorrelationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add correlation ID to each request.
    
    Enables request tracing across services and log entries.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Use existing correlation ID or generate new one
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))
        correlation_id.set(request_id)
        
        response = await call_next(request)
        response.headers['X-Request-ID'] = request_id
        
        return response


def setup_logging(level: str = "INFO", json_output: bool = True) -> None:
    """
    Configure logging for the application.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR).
        json_output: If True, output JSON format; otherwise plain text.
    
    Example:
        >>> setup_logging(level="INFO", json_output=True)
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    
    if json_output:
        handler.setFormatter(StructuredFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)8s | %(name)s | %(message)s'
        ))
    
    root_logger.addHandler(handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
