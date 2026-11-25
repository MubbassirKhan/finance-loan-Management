"""Pydantic schemas for authentication and administrative operations."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AdminLoginRequest(BaseModel):
    """Admin login request payload."""
    username: str = Field(..., min_length=3, max_length=50, description="Administrator username", examples=["admin"])
    password: str = Field(..., min_length=1, description="Administrator password")


class AdminResponse(BaseModel):
    """Admin user public profile response (never exposes password hash)."""
    admin_id: int
    username: str
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminLoginResponse(BaseModel):
    """Response returned upon successful administrator login."""
    message: str
    admin: AdminResponse
    session_token: Optional[str] = Field(
        None,
        description="Raw session token (also set in HttpOnly cookie for browser security)"
    )


class ChangePasswordRequest(BaseModel):
    """Password change request payload."""
    current_password: str = Field(..., min_length=1, description="Current password")
    new_password: str = Field(
        ...,
        min_length=8,
        description="New password (must be at least 8 chars, include letters, numbers, and special characters)"
    )
    confirm_password: str = Field(..., min_length=8, description="Confirmation of new password")


class MessageResponse(BaseModel):
    """Standard generic API response message."""
    message: str
    success: bool = True
