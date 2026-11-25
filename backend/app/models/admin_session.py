"""AdminSession model for database-backed session management."""
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

if TYPE_CHECKING:
    from app.models.admin import Admin


class AdminSession(Base):
    """AdminSession table: Stores hashed tokens and session metadata for active logins."""
    __tablename__ = "admin_sessions"

    session_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    admin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("admin.admin_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Store only the SHA-256 hash of the secure random session token
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship back to Admin
    admin: Mapped["Admin"] = relationship("Admin", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<AdminSession(session_id={self.session_id}, admin_id={self.admin_id}, revoked={self.is_revoked})>"
