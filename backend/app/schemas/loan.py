"""Pydantic schemas for Loan Management and Loan Payment transactions."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.enums import LoanTypeEnum
from app.schemas.user import UserDetailResponse


class LoanCreate(BaseModel):
    """Payload for disbursing / creating a new loan."""
    kgid: str = Field(..., min_length=1, max_length=50, description="Member KGID")
    ps_id: Optional[int] = Field(None, ge=1, description="Police Station ID (defaults to member's station)")
    loan_type: LoanTypeEnum = Field(..., description="Official loan scheme type")
    sanction_date: date = Field(..., description="Loan sanction date")
    sanction_amount: Decimal = Field(..., gt=0, decimal_places=2, description="Sanctioned loan amount")
    monthly_principal: Decimal = Field(..., ge=0, decimal_places=2, description="Monthly principal recovery")
    monthly_interest: Decimal = Field(..., ge=0, decimal_places=2, description="First monthly cutoff interest")
    interest_rate: Decimal = Field(..., ge=0, decimal_places=4, description="Annual interest percentage")
    start_month: str = Field(..., min_length=2, max_length=20, description="Repayment start month (e.g. November 2026)")
    end_date: date = Field(..., description="Expected loan end date")
    total_installments: int = Field(..., ge=1, le=360, description="Total number of installments")
    document_attachment: Optional[str] = Field(None, max_length=500, description="Optional document path/reference")
    status: str = Field("Active", max_length=30, description="Loan status (Sanctioned, Active, Closed)")

    @field_validator("kgid", "start_month", "status")
    @classmethod
    def strip_text(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Field cannot be empty.")
        return clean


class LoanUpdate(BaseModel):
    """Payload for updating an existing loan record."""
    ps_id: Optional[int] = Field(None, ge=1)
    loan_type: Optional[LoanTypeEnum] = None
    sanction_date: Optional[date] = None
    sanction_amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    monthly_principal: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    monthly_interest: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    interest_rate: Optional[Decimal] = Field(None, ge=0, decimal_places=4)
    start_month: Optional[str] = Field(None, min_length=2, max_length=20)
    end_date: Optional[date] = None
    total_installments: Optional[int] = Field(None, ge=1, le=360)
    document_attachment: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, max_length=30)


class LoanPaymentCreate(BaseModel):
    """Payload for recording a loan installment payment."""
    recovered_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Principal amount recovered")
    total_interest: Optional[Decimal] = Field(Decimal("0.00"), ge=0, decimal_places=2, description="Interest paid in this installment")
    paid_amount: Optional[Decimal] = Field(None, ge=0, decimal_places=2, description="Combined principal and interest amount paid")
    installment_number: Optional[int] = Field(None, ge=1, description="Exact installment row to receive")
    is_paid: bool = Field(True, description="Whether the installment payment is received")
    payment_date: date = Field(..., description="Date of payment")
    is_paid: bool = Field(True, description="Whether this installment is received")
    status: str = Field("Paid", max_length=30, description="Payment status (Paid, Partial, Waived)")


class LoanPaymentResponse(BaseModel):
    """Loan payment/schedule transaction record."""
    pay_id: int
    kgid: str
    loan_id: int
    installment_number: int
    opening_advance: Decimal
    recovered_amount: Decimal
    balance: Decimal
    total_interest: Decimal
    payable_amount: Decimal
    paid_amount: Decimal
    proof_attachment: Optional[str] = None
    is_paid: bool
    status: str
    payment_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoanResponse(BaseModel):
    """Enriched loan record including officer & station info and payment totals."""
    loan_id: int
    kgid: str
    ps_id: int
    loan_type: str
    sanction_date: date
    sanction_amount: Decimal
    monthly_principal: Decimal
    monthly_interest: Decimal
    interest_rate: Decimal = Decimal("0.0000")
    start_month: str
    end_date: date
    total_installments: int
    document_attachment: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    # Enriched member & station fields
    full_name: str
    designation: str
    buckle_number: Optional[str] = None
    share_number: Optional[str] = None
    station_name: str

    # Computed payment aggregates
    total_recovered: Decimal = Decimal("0.00")
    outstanding_balance: Decimal = Decimal("0.00")
    total_interest_paid: Decimal = Decimal("0.00")
    paid_installments: int = 0

    model_config = ConfigDict(from_attributes=True)


class LoanListResponse(BaseModel):
    """Paginated loan list response."""
    items: List[LoanResponse]
    total: int
    page: int
    size: int


class UserLoanHistoryResponse(BaseModel):
    """Complete officer profile, all loans, and transactional payment history."""
    user: UserDetailResponse
    loans: List[LoanResponse]
    payments: List[LoanPaymentResponse]
