"""FastAPI application initialization, middleware, routes, and exception handlers."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from datetime import date
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from app.core.config import settings
from app.database.connection import SessionLocal
from app.routes import auth, police_stations, users, loans, admin_management, reports
from app.services.user_service import generate_monthly_subscriptions

# Configure logger
logger = logging.getLogger("uvicorn.error")


def _generate_monthly_membership_records(year: int, month: int) -> int:
    db = SessionLocal()
    try:
        return generate_monthly_subscriptions(db, year, month)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _membership_subscription_scheduler() -> None:
    """Run once on startup for catch-up, then on each month's first day."""
    last_processed_period = None
    while True:
        current_date = date.today()
        period = (current_date.year, current_date.month)
        if last_processed_period != period and (
            last_processed_period is None or current_date.day == 1
        ):
            try:
                generated = await asyncio.to_thread(
                    _generate_monthly_membership_records,
                    current_date.year,
                    current_date.month,
                )
                logger.info(
                    "Generated %s monthly membership subscription record(s) for %04d-%02d.",
                    generated,
                    current_date.year,
                    current_date.month,
                )
                last_processed_period = period
            except Exception:
                logger.exception("Monthly membership subscription generation failed.")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown procedures."""
    # Ensure uploads directory exists on startup
    upload_path = settings.upload_path
    os.makedirs(upload_path, exist_ok=True)
    logger.info(f"Initialized uploads storage directory at: {upload_path}")
    logger.info(f"Started {settings.PROJECT_NAME} in [{settings.ENVIRONMENT}] mode.")
    scheduler_task = asyncio.create_task(_membership_subscription_scheduler())
    try:
        yield
    finally:
        scheduler_task.cancel()
        with suppress(asyncio.CancelledError):
            await scheduler_task
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
app.include_router(admin_management.router, prefix=settings.API_V1_PREFIX)
app.include_router(reports.router, prefix=settings.API_V1_PREFIX)
