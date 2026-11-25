"""API endpoints for Police Stations management."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.dependencies.auth import get_current_admin, require_password_changed
from app.models.admin import Admin
from app.schemas.auth import MessageResponse
from app.schemas.police_station import (
    PoliceStationCreate,
    PoliceStationUpdate,
    PoliceStationResponse,
    PoliceStationListResponse,
)
from app.services import police_station_service

router = APIRouter(prefix="/police-stations", tags=["Police Stations"])


@router.post(
    "",
    response_model=PoliceStationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Police Station",
    description="Adds a new police station or unit. Requires authenticated admin.",
)
def create_station(
    payload: PoliceStationCreate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Add new police station."""
    station, err = police_station_service.create_police_station(db, payload)
    if not station:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    return station


@router.get(
    "",
    response_model=PoliceStationListResponse,
    summary="List Police Stations",
    description="Retrieves a paginated list of police stations with optional search.",
)
def list_stations(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for station name"),
    active_only: bool = Query(False, description="Filter for active stations only"),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """List police stations."""
    clean_page = page if isinstance(page, int) else 1
    clean_size = size if isinstance(size, int) else 20
    clean_search = search if isinstance(search, str) else None
    clean_active = active_only if isinstance(active_only, bool) else False

    items, total = police_station_service.get_police_stations(
        db=db,
        page=clean_page,
        size=clean_size,
        search=clean_search,
        active_only=clean_active,
    )
    return PoliceStationListResponse(
        items=[PoliceStationResponse.model_validate(item) for item in items],
        total=total,
        page=clean_page,
        size=clean_size,
    )


@router.get(
    "/{ps_id}",
    response_model=PoliceStationResponse,
    summary="Get Police Station Details",
    description="Fetches single police station information by ID.",
)
def get_station(
    ps_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get single station by ID."""
    station = police_station_service.get_police_station_by_id(db, ps_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Police Station with ID {ps_id} not found."
        )
    return station


@router.put(
    "/{ps_id}",
    response_model=PoliceStationResponse,
    summary="Update Police Station",
    description="Updates police station name, address, or active status.",
)
def update_station(
    ps_id: int,
    payload: PoliceStationUpdate,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Update police station details."""
    station = police_station_service.get_police_station_by_id(db, ps_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Police Station with ID {ps_id} not found."
        )

    updated, err = police_station_service.update_police_station(db, station, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err)
    return updated


@router.patch(
    "/{ps_id}/deactivate",
    response_model=PoliceStationResponse,
    summary="Toggle Police Station Status",
    description="Toggles active/inactive status (soft-delete) of a police station.",
)
def toggle_station_status(
    ps_id: int,
    admin: Admin = Depends(require_password_changed),
    db: Session = Depends(get_db),
):
    """Toggle station active status."""
    station = police_station_service.get_police_station_by_id(db, ps_id)
    if not station:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Police Station with ID {ps_id} not found."
        )

    updated = police_station_service.toggle_station_status(db, station)
    return updated
