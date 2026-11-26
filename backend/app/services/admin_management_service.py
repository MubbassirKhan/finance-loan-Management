"""Administrator management and database maintenance operations."""
import logging
from typing import Dict, List, Optional, Tuple
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session
from app.core.security import hash_password, validate_password_strength, verify_password
from app.models.admin import Admin
from app.models.admin_session import AdminSession
from app.models.document import Document
from app.models.loan import Loan
from app.models.loan_payment import LoanPayment
from app.models.membership_fee import MembershipFee
from app.models.police_station import PoliceStation
from app.models.user import User
from app.schemas.admin_management import AdminCreateRequest, ClearDatabaseRequest

logger = logging.getLogger("uvicorn.error")


def get_admin_accounts(db: Session) -> List[Admin]:
    return list(db.execute(select(Admin).order_by(Admin.username.asc())).scalars().all())


def create_admin_account(db: Session, payload: AdminCreateRequest) -> Tuple[Optional[Admin], str]:
    if db.execute(select(Admin.admin_id).where(Admin.username == payload.username)).scalar_one_or_none():
        return None, "An administrator with this username already exists."

    password_valid, password_error = validate_password_strength(payload.password)
    if not password_valid:
        return None, password_error

    admin = Admin(
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin, ""


def get_admin_session_logs(db: Session, limit: int = 200) -> List[Dict[str, object]]:
    rows = db.execute(
        select(AdminSession, Admin.username)
        .join(Admin, Admin.admin_id == AdminSession.admin_id)
        .order_by(desc(AdminSession.created_at), desc(AdminSession.session_id))
        .limit(limit)
    ).all()
    return [
        {
            "session_id": session.session_id,
            "admin_id": session.admin_id,
            "username": username,
            "created_at": session.created_at,
            "last_activity_at": session.last_activity_at,
            "expires_at": session.expires_at,
            "is_revoked": session.is_revoked,
            "ip_address": session.ip_address,
            "user_agent": session.user_agent,
        }
        for session, username in rows
    ]


def clear_application_data(
    db: Session,
    current_admin: Admin,
    payload: ClearDatabaseRequest,
) -> Tuple[Optional[Dict[str, int]], str]:
    if not verify_password(payload.current_password, current_admin.password_hash):
        return None, "Current password is incorrect."

    tables_to_clear = (
        Document,
        LoanPayment,
        Loan,
        User,
        MembershipFee,
        PoliceStation,
        AdminSession,
    )

    try:
        deleted_counts = {}
        for model in tables_to_clear:
            result = db.execute(delete(model))
            deleted_counts[model.__tablename__] = result.rowcount or 0
        db.commit()
        logger.warning(
            "Administrator %s cleared application data while preserving admin accounts. Deleted rows: %s",
            current_admin.username,
            deleted_counts,
        )
        return deleted_counts, ""
    except Exception:
        db.rollback()
        raise