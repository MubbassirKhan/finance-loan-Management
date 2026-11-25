"""Document model for tracking uploaded member and loan attachments."""
from datetime import date, datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Date, DateTime, ForeignKey, BigInteger, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base
from app.models.enums import DocTypeEnum

if TYPE_CHECKING:
    from app.models.user import User


class Document(Base):
    """Documents table: Stores file metadata and paths for member and loan documents."""
    __tablename__ = "documents"

    doc_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # ENUM with 2 options: 'Membership' and 'Loan Application'
    doc_type: Mapped[DocTypeEnum] = mapped_column(
        SQLEnum(DocTypeEnum, name="doc_type_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    kgid: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.kgid", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    stored_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document(doc_id={self.doc_id}, type='{self.doc_type}', kgid='{self.kgid}')>"
