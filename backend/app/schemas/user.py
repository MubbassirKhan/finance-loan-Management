"""Pydantic schemas for police personnel member registration and listing."""
from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
import re


class UserBase(BaseModel):
    """Core attributes for police personnel membership."""
    kgid: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="KGID number (supports alphanumeric or numbers with leading zeros)",
        examples=["KGID-88349", "0045892"]
    )
    share_number: Optional[str] = Field(None, max_length=50, description="Unique share certificate number")
    buckle_number: Optional[str] = Field(None, max_length=50, description="Constabulary buckle or badge number")
    full_name: str = Field(..., min_length=2, max_length=150, description="Full name of police personnel")
    designation: str = Field(..., min_length=2, max_length=100, description="Designation / Rank (e.g., PSI, ASI, HC, PC)")
    ps_id: int = Field(..., ge=1, description="Assigned Police Station / Unit ID")
    bank_account_number: str = Field(..., min_length=5, max_length=50, description="Bank Account Number")
    ifsc_code: str = Field(..., min_length=11, max_length=11, description="11-character Bank IFSC Code")
    dob: date = Field(..., description="Date of Birth")
    gender: str = Field(..., max_length=20, description="Gender (Male, Female, Other)")
    caste: Optional[str] = Field(None, max_length=50)
    sub_caste: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50, description="Reservation Category (e.g., GM, 2A, 2B, 3A, 3B, SC, ST)")
    financial_year: str = Field(..., min_length=4, max_length=20, examples=["2025-2026"])
    financial_month: str = Field(..., min_length=3, max_length=20, examples=["April"])
    mf_id: int = Field(..., ge=1, description="Applicable Membership Fee Tier ID")

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        clean = v.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean):
            raise ValueError("Invalid IFSC code format. Expected standard 11-character IFSC (e.g. SBIN0001234)")
        return clean

    @field_validator("kgid")
    @classmethod
    def validate_kgid(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("KGID cannot be empty or whitespace.")
        return clean


class UserCreate(UserBase):
    """Payload for registering a new member."""
    pass


class UserUpdate(BaseModel):
    """Payload for modifying member details."""
    share_number: Optional[str] = Field(None, max_length=50)
    buckle_number: Optional[str] = Field(None, max_length=50)
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    designation: Optional[str] = Field(None, min_length=2, max_length=100)
    ps_id: Optional[int] = Field(None, ge=1)
    bank_account_number: Optional[str] = Field(None, min_length=5, max_length=50)
    ifsc_code: Optional[str] = Field(None, min_length=11, max_length=11)
    dob: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    caste: Optional[str] = Field(None, max_length=50)
    sub_caste: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    financial_year: Optional[str] = Field(None, max_length=20)
    financial_month: Optional[str] = Field(None, max_length=20)
    mf_id: Optional[int] = Field(None, ge=1)

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        clean = value.strip().upper()
        if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", clean):
            raise ValueError("Invalid IFSC code format.")
        return clean


class UserStatusUpdate(BaseModel):
    status: Literal["Active", "Inactive"]


class UserResponse(BaseModel):
    """Public member profile response with masked bank account protection."""
    kgid: str
    share_number: Optional[str]
    buckle_number: Optional[str]
    full_name: str
    designation: str
    ps_id: int
    police_station_name: Optional[str] = None
    # Masked bank account number for security (e.g. *******1234)
    bank_account_masked: str
    ifsc_code: str
    dob: date
    gender: str
    caste: Optional[str]
    sub_caste: Optional[str]
    category: Optional[str]
    financial_year: str
    financial_month: str
    status: str
    mf_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(UserResponse):
    """Detailed member profile including unmasked bank info and fee structure (restricted to authorized Admin)."""
    bank_account_number: str


class DocumentResponse(BaseModel):
    doc_id: int
    doc_type: str
    original_filename: Optional[str]
    file_size_bytes: Optional[int]
    stored_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    size: int
