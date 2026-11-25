"""Loan model representing loan applications and sanctions."""
from datetime import date
from decimal import Decimal
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Numeric, Date, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin
from app.models.enums import LoanTypeEnum

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.police_station import PoliceStation
    from app.models.loan_payment import LoanPayment


class Loan(Base, TimestampMixin):
    """Loans table: Stores loan sanction and schedule details for police personnel."""
    __tablename__ = "loans"

    loan_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kgid: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.kgid", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    ps_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("police_stations.ps_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    # ENUM with SP Office schemes:
    # 'Society Personal Advance', 'Housing Assistance Advance', 'Emergency Medical Advance',
    # 'Festival Advance', 'Education Assistance Advance'
    loan_type: Mapped[LoanTypeEnum] = mapped_column(
        SQLEnum(LoanTypeEnum, name="loan_type_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )
    sanction_date: Mapped[date] = mapped_column(Date, nullable=False)
    sanction_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    monthly_principal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    monthly_interest: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal("0.0000"), server_default="0")
    start_month: Mapped[str] = mapped_column(String(20), nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_installments: Mapped[int] = mapped_column(Integer, nullable=False)
    document_attachment: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Sanctioned", nullable=False, index=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="loans")
    police_station: Mapped["PoliceStation"] = relationship("PoliceStation", back_populates="loans")
    payments: Mapped[List["LoanPayment"]] = relationship(
        "LoanPayment",
        back_populates="loan",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Loan(loan_id={self.loan_id}, kgid='{self.kgid}', amount={self.sanction_amount})>"
