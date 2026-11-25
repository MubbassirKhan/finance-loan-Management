"""FastAPI application initialization, middleware, routes, and exception handlers."""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.routes import auth, police_stations, users, loans

# Configure logger
logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown procedures."""
    # Ensure uploads directory exists on startup
    upload_path = settings.upload_path
    os.makedirs(upload_path, exist_ok=True)
    logger.info(f"Initialized uploads storage directory at: {upload_path}")
    logger.info(f"Started {settings.PROJECT_NAME} in [{settings.ENVIRONMENT}] mode.")
    yield
    logger.info("Application shutdown completed.")


# FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Official backend API for the Superintendent of Police (SP) Office "
        "Membership and Fund Management System. Provides secure Admin session authentication, "
        "police station registries, personnel membership tracking, and fund data models."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
origins = settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """Handles database constraint violations gracefully without exposing raw DB errors."""
    logger.error(f"Database Integrity Error: {str(exc.orig)}")
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": "A database constraint violation occurred (duplicate record or invalid reference).",
            "error_type": "DatabaseIntegrityError",
        },
    )


# Health Check Endpoints
@app.get("/health", tags=["Health"], summary="System Health Check")
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Health"], summary="API v1 Health Check")
def health_check():
    """Health check endpoint to verify that the server is running."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


# Register Application Routers under /api/v1
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(police_stations.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(loans.router, prefix=settings.API_V1_PREFIX)
