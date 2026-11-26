"""Response schemas for administrative analytics reports."""
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class ReportSummary(BaseModel):
    membership_count: int
    active_members: int
    loan_count: int
    sanctioned_amount: Decimal
    recovered_amount: Decimal
    outstanding_amount: Decimal
    open_loans: int
    closed_loans: int


class ReportTrendItem(BaseModel):
    period: str
    membership_count: int
    loan_count: int
    sanctioned_amount: Decimal
    recovered_amount: Decimal


class ReportDemographicItem(BaseModel):
    label: str
    membership_count: int
    loan_count: int
    sanctioned_amount: Decimal
    recovered_amount: Decimal


class ReportAnalyticsResponse(BaseModel):
    year: int
    month: Optional[int]
    summary: ReportSummary
    trend: List[ReportTrendItem]
    gender_breakdown: List[ReportDemographicItem]
    caste_breakdown: List[ReportDemographicItem]