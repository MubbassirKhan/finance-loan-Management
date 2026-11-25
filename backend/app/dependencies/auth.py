"""FastAPI authentication dependencies for protecting routes."""
from typing import Optional
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.connection import get_db
from app.models.admin import Admin
from app.services import auth_service


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extracts session token from HttpOnly cookie or Authorization Bearer header."""
    # Check session cookie first (preferred browser method)
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if token:
        return token

    # Check Authorization header (useful for Swagger UI or API testing)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):].strip()

    return None


def get_current_admin(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Admin:
    """Verifies that the request carries a valid, active administrator session.
    
    Raises 401 Unauthorized if the session token is missing, invalid, expired,
    or timed out due to inactivity. Cleans up stale cookies automatically.
    """
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session, reason = auth_service.get_active_session_by_token(db, token)
    if not session:
        # Clear stale cookie if present
        response.delete_cookie(
            key=settings.SESSION_COOKIE_NAME,
            path="/",
            httponly=settings.COOKIE_HTTPONLY,
            samesite=settings.COOKIE_SAMESITE,
            secure=settings.COOKIE_SECURE,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Session invalid: {reason}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    admin = session.admin
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Administrator account is inactive or disabled.",
        )

    return admin


def require_password_changed(
    admin: Admin = Depends(get_current_admin),
) -> Admin:
    """Enforces that the administrator must change their initial password before accessing other features.
    
    Raises 403 Forbidden if must_change_password is True.
    """
    if admin.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Initial password change required. For security reasons, you must change your initial "
                "password at /api/v1/auth/change-password before performing administrative actions."
            ),
        )
    return admin
