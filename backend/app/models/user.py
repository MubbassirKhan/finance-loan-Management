"""User model representing police personnel membership."""
from datetime import date
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Date, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.police_station import PoliceStation
    from app.models.membership_fee import MembershipFee
    from app.models.document import Document
    from app.models.loan import Loan
    from app.models.loan_payment import LoanPayment


class User(Base, TimestampMixin):
    """Users table: Stores police personnel membership details.
    
    Identified primarily by KGID (String/VARCHAR format supporting alphabets or leading zeros).
    """
    __tablename__ = "users"

    # KGID as String Primary Key
    kgid: Mapped[str] = mapped_column(String(50), primary_key=True)
    share_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)
    buckle_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)

    # Unit / Station Reference
    ps_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("police_stations.ps_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Banking details
    bank_account_number: Mapped[str] = mapped_column(String(50), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(20), nullable=False)

    # Personal details
    dob: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    caste: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    sub_caste: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Financial membership period
    financial_year: Mapped[str] = mapped_column(String(20), nullable=False)
    financial_month: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Active", nullable=False, index=True)

    # Fee tier reference
    mf_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("membership_fees.mf_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    police_station: Mapped["PoliceStation"] = relationship("PoliceStation", back_populates="users")
    membership_fee: Mapped["MembershipFee"] = relationship("MembershipFee", back_populates="users")
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    loans: Mapped[List["Loan"]] = relationship(
        "Loan",
        back_populates="user",
    )
    loan_payments: Mapped[List["LoanPayment"]] = relationship(
        "LoanPayment",
        back_populates="user",
    )

    __table_args__ = (
        Index("ix_users_name_station", "full_name", "ps_id"),
    )

    def __repr__(self) -> str:
        return f"<User(kgid='{self.kgid}', name='{self.full_name}', rank='{self.designation}')>"
