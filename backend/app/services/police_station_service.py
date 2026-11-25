"""Service layer for Police Stations management."""
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.police_station import PoliceStation
from app.schemas.police_station import PoliceStationCreate, PoliceStationUpdate


def create_police_station(
    db: Session,
    payload: PoliceStationCreate,
) -> Tuple[Optional[PoliceStation], str]:
    """Creates a new police station ensuring station name uniqueness."""
    name_clean = payload.station_name.strip()
    
    # Check duplicate station name
    stmt = select(PoliceStation).where(
        func.lower(PoliceStation.station_name) == func.lower(name_clean)
    )
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        return None, f"Police station with name '{name_clean}' already exists."

    station = PoliceStation(
        station_name=name_clean,
        address=payload.address.strip() if payload.address else None,
        is_active=True,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return station, ""


def get_police_stations(
    db: Session,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    active_only: bool = False,
) -> Tuple[List[PoliceStation], int]:
    """Retrieves paginated police stations with optional search and active status filter."""
    stmt = select(PoliceStation)
    
    if active_only is True:
        stmt = stmt.where(PoliceStation.is_active.is_(True))
        
    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(func.lower(PoliceStation.station_name).like(term))
        
    # Count total matching
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar() or 0
    
    # Order and paginate
    stmt = stmt.order_by(PoliceStation.station_name.asc())
    stmt = stmt.offset((page - 1) * size).limit(size)
    
    items = list(db.execute(stmt).scalars().all())
    return items, total


def get_police_station_by_id(db: Session, ps_id: int) -> Optional[PoliceStation]:
    """Fetches a single police station by ID."""
    return db.get(PoliceStation, ps_id)


def update_police_station(
    db: Session,
    station: PoliceStation,
    payload: PoliceStationUpdate,
) -> Tuple[Optional[PoliceStation], str]:
    """Updates police station details."""
    if payload.station_name is not None:
        name_clean = payload.station_name.strip()
        # Ensure new name is not taken by another station
        stmt = select(PoliceStation).where(
            func.lower(PoliceStation.station_name) == func.lower(name_clean),
            PoliceStation.ps_id != station.ps_id,
        )
        if db.execute(stmt).scalar_one_or_none():
            return None, f"Another police station with name '{name_clean}' already exists."
        station.station_name = name_clean

    if payload.address is not None:
        station.address = payload.address.strip() if payload.address else None

    if payload.is_active is not None:
        station.is_active = payload.is_active

    db.add(station)
    db.commit()
    db.refresh(station)
    return station, ""


def toggle_station_status(db: Session, station: PoliceStation) -> PoliceStation:
    """Toggles active/deactive status of a police station."""
    station.is_active = not station.is_active
    db.add(station)
    db.commit()
    db.refresh(station)
    return station
