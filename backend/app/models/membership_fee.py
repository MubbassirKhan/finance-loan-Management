"""MembershipFee model for configurable fee structures."""
from decimal import Decimal
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, Numeric, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class MembershipFee(Base, TimestampMixin):
    """MembershipFees table: Holds configurable fee tiers (Subscription, Share, Membership)."""
    __tablename__ = "membership_fees"

    mf_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    share_subscription_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    share_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    membership_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="membership_fee",
    )

    def __repr__(self) -> str:
        return (
            f"<MembershipFee(mf_id={self.mf_id}, "
            f"sub={self.share_subscription_fee}, share={self.share_fee}, fee={self.membership_fee})>"
        )
