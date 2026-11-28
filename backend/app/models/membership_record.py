"""Membership tier history and monthly subscription ledger records."""
from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, TimestampMixin


class MembershipRecord(Base, TimestampMixin):
    """Stores tier assignment periods and subscription snapshots in one ledger."""
    __tablename__ = "membership_records"

    record_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kgid: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("users.kgid", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    mf_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("membership_fees.mf_id", ondelete="RESTRICT"),
        nullable=False,
    )
    record_type: Mapped[str] = mapped_column(String(20), nullable=False)
    effective_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expires_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    transaction_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    membership_record_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("membership_records.record_id", ondelete="RESTRICT"),
        nullable=True,
    )

    __table_args__ = (
        CheckConstraint(
            "(record_type = 'membership' AND effective_from IS NOT NULL "
            "AND amount IS NULL AND month IS NULL AND year IS NULL "
            "AND transaction_date IS NULL AND membership_record_id IS NULL) OR "
            "(record_type = 'subscription' AND effective_from IS NULL "
            "AND expires_at IS NULL AND amount IS NOT NULL AND amount >= 0 "
            "AND month IS NOT NULL AND month BETWEEN 1 AND 12 "
            "AND year IS NOT NULL AND transaction_date IS NOT NULL "
            "AND membership_record_id IS NOT NULL)",
            name="ck_membership_records_record_fields",
        ),
        CheckConstraint(
            "record_type IN ('membership', 'subscription')",
            name="ck_membership_records_record_type",
        ),
        CheckConstraint(
            "expires_at IS NULL OR effective_from IS NULL OR expires_at >= effective_from",
            name="ck_membership_records_valid_period",
        ),
        Index(
            "uq_membership_records_active_assignment",
            "kgid",
            unique=True,
            postgresql_where=text("record_type = 'membership' AND expires_at IS NULL"),
            sqlite_where=text("record_type = 'membership' AND expires_at IS NULL"),
        ),
        Index(
            "uq_membership_records_monthly_subscription",
            "kgid",
            "year",
            "month",
            unique=True,
            postgresql_where=text("record_type = 'subscription'"),
            sqlite_where=text("record_type = 'subscription'"),
        ),
    )