"""Authentication service layer handling credential validation, sessions, and security."""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from app.core.config import settings
from app.core.security import (
    verify_password,
    hash_password,
    generate_session_token,
    hash_session_token,
    validate_password_strength,
)
from app.core.session import (
    calculate_session_expiry,
    validate_session,
    get_current_utc,
)
from app.models.admin import Admin
from app.models.admin_session import AdminSession


# Simple in-memory tracker for failed login attempts to protect against brute-force attacks
# {ip_address: {"count": int, "locked_until": datetime}}
_failed_attempts: Dict[str, Dict] = {}


def check_login_lockout(client_ip: str) -> Tuple[bool, Optional[str]]:
    """Checks if the client IP is temporarily locked out due to failed attempts."""
    now = get_current_utc()
    record = _failed_attempts.get(client_ip)
    if not record:
        return False, None
    
    locked_until = record.get("locked_until")
    if locked_until and now < locked_until:
        remaining_secs = int((locked_until - now).total_seconds())
        remaining_mins = max(1, remaining_secs // 60)
        return True, f"Too many failed login attempts. Account temporarily locked for {remaining_mins} more minute(s)."
    
    # If lockout expired, reset
    if locked_until and now >= locked_until:
        _failed_attempts.pop(client_ip, None)
        
    return False, None


def register_failed_attempt(client_ip: str) -> None:
    """Increments the failed login attempt counter and sets lockout if threshold reached."""
    now = get_current_utc()
    record = _failed_attempts.setdefault(client_ip, {"count": 0, "locked_until": None})
    record["count"] += 1
    
    if record["count"] >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
        record["locked_until"] = now + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)


def reset_failed_attempts(client_ip: str) -> None:
    """Resets failed attempt tracker on successful login."""
    _failed_attempts.pop(client_ip, None)


def authenticate_admin(
    db: Session,
    username: str,
    password: str,
    client_ip: str = "127.0.0.1",
) -> Tuple[Optional[Admin], str]:
    """Validates admin credentials with rate-limiting protection.
    
    Returns:
        (admin_object or None, error_message or "")
    """
    is_locked, lockout_msg = check_login_lockout(client_ip)
    if is_locked:
        return None, lockout_msg or "Account temporarily locked."

    stmt = select(Admin).where(Admin.username == username.strip())
    admin = db.execute(stmt).scalar_one_or_none()

    if not admin:
        register_failed_attempt(client_ip)
        return None, "Invalid username or password."

    if not admin.is_active:
        return None, "Admin account is deactivated. Please contact system management."

    if not verify_password(password, admin.password_hash):
        register_failed_attempt(client_ip)
        return None, "Invalid username or password."

    # Successful login: reset failed counters
    reset_failed_attempts(client_ip)
    return admin, ""


def create_admin_session(
    db: Session,
    admin: Admin,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[str, AdminSession]:
    """Generates an unpredictable session token, stores its SHA-256 hash in DB, and returns raw token."""
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = calculate_session_expiry()
    now = get_current_utc()

    new_session = AdminSession(
        admin_id=admin.admin_id,
        token_hash=token_hash,
        expires_at=expires_at,
        last_activity_at=now,
        is_revoked=False,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return raw_token, new_session


def get_active_session_by_token(
    db: Session,
    raw_token: str,
) -> Tuple[Optional[AdminSession], str]:
    """Resolves raw session token to an active AdminSession, validating expiry and inactivity."""
    token_hash = hash_session_token(raw_token)
    stmt = (
        select(AdminSession)
        .where(AdminSession.token_hash == token_hash)
        .where(AdminSession.is_revoked.is_(False))
    )
    session = db.execute(stmt).scalar_one_or_none()

    is_valid, reason = validate_session(session)
    if not is_valid or not session:
        return None, reason

    # Touch last_activity_at timestamp to reset inactivity counter
    session.last_activity_at = get_current_utc()
    db.commit()
    return session, "OK"


def revoke_session(db: Session, raw_token: str) -> bool:
    """Revokes the given session token upon logout."""
    token_hash = hash_session_token(raw_token)
    stmt = (
        update(AdminSession)
        .where(AdminSession.token_hash == token_hash)
        .values(is_revoked=True)
    )
    result = db.execute(stmt)
    db.commit()
    return result.rowcount > 0


def change_admin_password(
    db: Session,
    admin: Admin,
    current_password: str,
    new_password: str,
    confirm_password: str,
    current_raw_token: Optional[str] = None,
) -> Tuple[bool, str]:
    """Changes administrator password, resets must_change_password flag, and revokes other sessions."""
    # Confirm passwords match
    if new_password != confirm_password:
        return False, "New password and confirmation password do not match."

    # Validate complexity
    is_strong, msg = validate_password_strength(new_password)
    if not is_strong:
        return False, msg

    # Cannot be identical to current password
    if verify_password(new_password, admin.password_hash):
        return False, "New password cannot be the same as the current password."

    # Verify current password
    if not verify_password(current_password, admin.password_hash):
        return False, "Current password is incorrect."

    # Update password and clear must_change_password
    admin.password_hash = hash_password(new_password)
    admin.must_change_password = False
    db.add(admin)

    # Invalidate all other sessions except current for security
    if current_raw_token:
        curr_hash = hash_session_token(current_raw_token)
        db.execute(
            update(AdminSession)
            .where(AdminSession.admin_id == admin.admin_id)
            .where(AdminSession.token_hash != curr_hash)
            .values(is_revoked=True)
        )

    db.commit()
    db.refresh(admin)
    return True, "Password changed successfully."
