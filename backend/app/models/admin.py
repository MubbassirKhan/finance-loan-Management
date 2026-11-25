"""Admin model representing system administrator."""
from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.admin_session import AdminSession


class Admin(Base, TimestampMixin):
    """Admin table: Supports the single administrator managing the application."""
    __tablename__ = "admin"

    admin_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    sessions: Mapped[List["AdminSession"]] = relationship(
        "AdminSession",
        back_populates="admin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Admin(admin_id={self.admin_id}, username='{self.username}', active={self.is_active})>"
