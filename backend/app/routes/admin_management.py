"""Protected administrator account, session log, and database maintenance routes."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings as app_settings
from app.database.connection import get_db
from app.dependencies.auth import require_password_changed
from app.models.admin import Admin
from app.schemas.admin_management import (
    AdminAccountResponse,
    AdminCreateRequest,
    AdminSessionLogResponse,
    ClearDatabaseRequest,
    ClearDatabaseResponse,
)
from app.services import admin_management_service

router = APIRouter(prefix="/admin-management", tags=["Administrator Management"])


@router.get("/admins", response_model=List[AdminAccountResponse], summary="List Administrator Accounts")
def list_admin_accounts(
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    return admin_management_service.get_admin_accounts(db)


@router.post(
    "/admins",
    response_model=AdminAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Administrator Account",
)
def create_admin_account(
    payload: AdminCreateRequest,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    created_admin, error = admin_management_service.create_admin_account(db, payload)
    if not created_admin:
        status_code = status.HTTP_409_CONFLICT if "already exists" in error else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=error)
    return created_admin


@router.get(
    "/sessions",
    response_model=List[AdminSessionLogResponse],
    summary="List Administrator Session Logs",
)
def list_admin_session_logs(
    limit: int = Query(200, ge=1, le=500),
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    return admin_management_service.get_admin_session_logs(db, limit)


@router.post(
    "/clear-database",
    response_model=ClearDatabaseResponse,
    summary="Clear Application Data While Preserving Administrators",
)
def clear_database(
    payload: ClearDatabaseRequest,
    response: Response,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    deleted_counts, error = admin_management_service.clear_application_data(db, admin, payload)
    if error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error)
    response.delete_cookie(
        key=app_settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=app_settings.COOKIE_HTTPONLY,
        secure=app_settings.COOKIE_SECURE,
        samesite=app_settings.COOKIE_SAMESITE,
    )
    return ClearDatabaseResponse(
        message="Application data cleared. Administrator accounts were preserved.",
        deleted_counts=deleted_counts or {},
    )