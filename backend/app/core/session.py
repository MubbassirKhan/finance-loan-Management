"""Session lifecycle management and validation utilities."""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from app.core.config import settings
from app.models.admin_session import AdminSession


def get_current_utc() -> datetime:
    """Returns the current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def calculate_session_expiry() -> datetime:
    """Calculates absolute expiration timestamp for a new session."""
    return get_current_utc() + timedelta(hours=settings.SESSION_EXPIRE_HOURS)


def is_session_expired(session: AdminSession, now: Optional[datetime] = None) -> bool:
    """Checks whether the session has reached its absolute expiration time."""
    if now is None:
        now = get_current_utc()
    # Normalize comparison across timezone-aware/naive datetimes
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return now >= expires_at


def is_session_inactive(session: AdminSession, now: Optional[datetime] = None) -> bool:
    """Checks whether the session has exceeded the inactivity idle timeout."""
    if now is None:
        now = get_current_utc()
    last_activity = session.last_activity_at
    if last_activity.tzinfo is None:
        last_activity = last_activity.replace(tzinfo=timezone.utc)

    idle_seconds = (now - last_activity).total_seconds()
    max_idle_seconds = settings.SESSION_INACTIVITY_MINUTES * 60
    return idle_seconds > max_idle_seconds


def validate_session(session: Optional[AdminSession]) -> Tuple[bool, str]:
    """Validates session state against revocation, expiry, and inactivity.
    
    Returns:
        (is_valid: bool, reason: str)
    """
    if not session:
        return False, "Session not found."
    if session.is_revoked:
        return False, "Session has been revoked or logged out."
    
    now = get_current_utc()
    if is_session_expired(session, now):
        return False, "Session has expired. Please log in again."
    if is_session_inactive(session, now):
        return False, "Session timed out due to inactivity. Please log in again."
        
    return True, "Session is valid."
