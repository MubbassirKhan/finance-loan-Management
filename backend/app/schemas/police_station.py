"""Pydantic schemas for Police Station operations."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class PoliceStationBase(BaseModel):
    station_name: str = Field(..., min_length=2, max_length=150, description="Unique police station or unit name")
    address: Optional[str] = Field(None, max_length=1000, description="Full postal or physical address")


class PoliceStationCreate(PoliceStationBase):
    pass


class PoliceStationUpdate(BaseModel):
    station_name: Optional[str] = Field(None, min_length=2, max_length=150)
    address: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = Field(None, description="Active status toggle")


class PoliceStationResponse(PoliceStationBase):
    ps_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PoliceStationListResponse(BaseModel):
    items: List[PoliceStationResponse]
    total: int
    page: int
    size: int
