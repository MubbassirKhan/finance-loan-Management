"""Authentication routes for Administrator login, logout, profile, and password update."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.connection import get_db
from app.dependencies.auth import get_current_admin, extract_token_from_request
from app.models.admin import Admin
from app.schemas.auth import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminResponse,
    ChangePasswordRequest,
    MessageResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Admin Authentication"])


@router.post(
    "/login",
    response_model=AdminLoginResponse,
    summary="Admin Login",
    description=(
        "Authenticates the single administrator. Upon success, creates a secure database-backed "
        "session and sets an HttpOnly, Secure, SameSite session cookie."
    ),
)
def login(
    payload: AdminLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate administrator and initiate session."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    admin, err_msg = auth_service.authenticate_admin(
        db=db,
        username=payload.username,
        password=payload.password,
        client_ip=client_ip,
    )

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_msg,
        )

    # Create new database session
    raw_token, session_obj = auth_service.create_admin_session(
        db=db,
        admin=admin,
        ip_address=client_ip,
        user_agent=user_agent,
    )

    # Set secure HttpOnly cookie
    max_age_seconds = settings.SESSION_EXPIRE_HOURS * 3600
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=max_age_seconds,
        expires=max_age_seconds,
        path="/",
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )

    welcome_msg = (
        "Login successful. NOTICE: You must change your default password."
        if admin.must_change_password
        else "Login successful."
    )

    return AdminLoginResponse(
        message=welcome_msg,
        admin=AdminResponse.model_validate(admin),
        session_token=raw_token,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Admin Logout",
    description="Revokes the active database session and clears the session cookie.",
)
def logout(
    request: Request,
    response: Response,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Revoke session and clear cookies."""
    token = extract_token_from_request(request)
    if token:
        auth_service.revoke_session(db, token)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=settings.COOKIE_HTTPONLY,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )

    return MessageResponse(message="Logged out successfully.")


@router.get(
    "/me",
    response_model=AdminResponse,
    summary="Current Admin Profile",
    description="Returns the currently authenticated administrator profile and password status.",
)
def get_me(
    current_admin: Admin = Depends(get_current_admin),
):
    """Get current admin details."""
    return AdminResponse.model_validate(current_admin)


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change Admin Password",
    description=(
        "Changes the administrator password. Required after first login. "
        "Upon change, must_change_password is set to False."
    ),
)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Change initial or existing password."""
    token = extract_token_from_request(request)
    success, msg = auth_service.change_admin_password(
        db=db,
        admin=current_admin,
        current_password=payload.current_password,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
        current_raw_token=token,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )

    return MessageResponse(message=msg)
