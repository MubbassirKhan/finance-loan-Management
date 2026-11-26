"""Administrative analytics report endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.dependencies.auth import get_current_admin
from app.models.admin import Admin
from app.schemas.report import ReportAnalyticsResponse
from app.services.report_service import get_report_analytics

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/analytics", response_model=ReportAnalyticsResponse, summary="Get Report Analytics")
def report_analytics(
    year: int = Query(..., ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get period activity and current portfolio balances for reports."""
    return get_report_analytics(db, year, month)