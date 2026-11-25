"""Pydantic schemas for Membership Fee configuration tiers."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MembershipFeeBase(BaseModel):
    share_subscription_fee: Decimal = Field(..., ge=0, description="Monthly Share/Subscription Fee")
    share_fee: Decimal = Field(..., ge=0, description="One-time or recurring Share Fee")
    membership_fee: Decimal = Field(..., ge=0, description="Standard Membership Fee")
    description: Optional[str] = Field(None, max_length=100, description="Tier or cadre description")


class MembershipFeeCreate(MembershipFeeBase):
    pass


class MembershipFeeResponse(MembershipFeeBase):
    mf_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MembershipFeeListResponse(BaseModel):
    items: List[MembershipFeeResponse]
    total: int
