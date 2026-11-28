"""API schemas for membership history and monthly subscription records."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class MembershipRecordResponse(BaseModel):
    record_id: int
    kgid: str
    mf_id: int
    record_type: str
    effective_from: Optional[date] = None
    expires_at: Optional[date] = None
    amount: Optional[Decimal] = None
    month: Optional[int] = None
    year: Optional[int] = None
    transaction_date: Optional[date] = None
    membership_record_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)