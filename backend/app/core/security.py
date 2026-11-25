"""Security utilities for password hashing and session token generation."""
import hashlib
import re
import secrets
from typing import Tuple
import bcrypt


def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with automatic salting."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a stored bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


def generate_session_token() -> str:
    """Generates a cryptographically secure random session token.
    
    Returns a 43-character URL-safe string with 256 bits of entropy.
    """
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Hashes a session token using SHA-256 before database storage.
    
    Ensures that even if the database is compromised, the raw session token
    cannot be recovered or used to impersonate the administrator.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validates that a new password meets administrative security standards."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Za-z]", password):
        return False, "Password must contain at least one alphabet character."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one numeric digit."
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character (!@#$%^&* etc.)."
    return True, ""
