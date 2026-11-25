"""PoliceStation model."""
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Integer, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.loan import Loan


class PoliceStation(Base, TimestampMixin):
    """PoliceStation table: Represents police stations or departmental units."""
    __tablename__ = "police_stations"

    ps_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User",
        back_populates="police_station",
    )
    loans: Mapped[List["Loan"]] = relationship(
        "Loan",
        back_populates="police_station",
    )

    def __repr__(self) -> str:
        return f"<PoliceStation(ps_id={self.ps_id}, name='{self.station_name}', active={self.is_active})>"
