"""Schemas for administrator management and controlled database maintenance."""
from datetime import datetime
from typing import Dict, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AdminCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("Username cannot be empty.")
        return clean_value


class AdminAccountResponse(BaseModel):
    admin_id: int
    username: str
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminSessionLogResponse(BaseModel):
    session_id: int
    admin_id: int
    username: str
    created_at: datetime
    last_activity_at: datetime
    expires_at: datetime
    is_revoked: bool
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ClearDatabaseRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    confirmation: Literal["DELETE ALL DATA"]


class ClearDatabaseResponse(BaseModel):
    message: str
    deleted_counts: Dict[str, int]