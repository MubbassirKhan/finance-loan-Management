"""LoanPayment model for tracking installment recoveries and interest."""
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Integer, String, Numeric, Date, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.loan import Loan


class LoanPayment(Base, TimestampMixin):
    """LoanPayments table: Records installment recovery amounts, outstanding balance, and interest."""
    __tablename__ = "loan_payments"

    pay_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kgid: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.kgid", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    loan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("loans.loan_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    installment_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    opening_advance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    recovered_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_interest: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payable_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    proof_attachment: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="Projected", nullable=False, index=True)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, index=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="loan_payments")
    loan: Mapped["Loan"] = relationship("Loan", back_populates="payments")

    def __repr__(self) -> str:
        return f"<LoanPayment(pay_id={self.pay_id}, loan_id={self.loan_id}, recovered={self.recovered_amount})>"
