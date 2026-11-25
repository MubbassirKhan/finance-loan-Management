"""Service layer for Police Personnel Members and Membership Fees."""
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from app.models.user import User
from app.models.police_station import PoliceStation
from app.models.membership_fee import MembershipFee
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.membership_fee import MembershipFeeCreate


def mask_bank_account(account_number: str) -> str:
    """Masks all but the last 4 digits of a bank account number for privacy."""
    clean = account_number.strip()
    if len(clean) <= 4:
        return "****"
    return "*" * (len(clean) - 4) + clean[-4:]


def create_member(
    db: Session,
    payload: UserCreate,
) -> Tuple[Optional[User], str]:
    """Registers a new police personnel member with foreign key and uniqueness validations."""
    kgid_clean = payload.kgid.strip()

    # 1. Check KGID uniqueness
    existing_kgid = db.get(User, kgid_clean)
    if existing_kgid:
        return None, f"A member with KGID '{kgid_clean}' is already registered."

    # 2. Check Share Number uniqueness if provided
    if payload.share_number:
        share_clean = payload.share_number.strip()
        stmt = select(User).where(User.share_number == share_clean)
        if db.execute(stmt).scalar_one_or_none():
            return None, f"Share Number '{share_clean}' is already assigned to another member."

    # 3. Check Police Station existence and active status
    station = db.get(PoliceStation, payload.ps_id)
    if not station:
        return None, f"Police Station with ID {payload.ps_id} does not exist."
    if not station.is_active:
        return None, f"Police Station '{station.station_name}' is currently inactive. Cannot assign new personnel."

    # 4. Check Membership Fee tier existence and active status
    fee_tier = db.get(MembershipFee, payload.mf_id)
    if not fee_tier:
        return None, f"Membership Fee Tier with ID {payload.mf_id} does not exist."
    if not fee_tier.is_active:
        return None, f"Membership Fee Tier ID {payload.mf_id} is inactive."

    # 5. Create new User record
    new_user = User(
        kgid=kgid_clean,
        share_number=payload.share_number.strip() if payload.share_number else None,
        buckle_number=payload.buckle_number.strip() if payload.buckle_number else None,
        full_name=payload.full_name.strip(),
        designation=payload.designation.strip(),
        ps_id=payload.ps_id,
        bank_account_number=payload.bank_account_number.strip(),
        ifsc_code=payload.ifsc_code.strip().upper(),
        dob=payload.dob,
        gender=payload.gender.strip(),
        caste=payload.caste.strip() if payload.caste else None,
        sub_caste=payload.sub_caste.strip() if payload.sub_caste else None,
        category=payload.category.strip() if payload.category else None,
        financial_year=payload.financial_year.strip(),
        financial_month=payload.financial_month.strip(),
        status="Active",
        mf_id=payload.mf_id,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user, ""


def update_member(
    db: Session,
    kgid: str,
    payload: UserUpdate,
) -> Tuple[Optional[User], str]:
    """Updates a member profile without changing its KGID."""
    member = db.get(User, kgid.strip())
    if not member:
        return None, "Member not found."

    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    share_number = changes.get("share_number")
    if share_number:
        share_number = share_number.strip()
        duplicate = db.execute(
            select(User).where(User.share_number == share_number, User.kgid != member.kgid)
        ).scalar_one_or_none()
        if duplicate:
            return None, f"Share Number '{share_number}' is already assigned to another member."
        changes["share_number"] = share_number
    elif "share_number" in changes:
        changes["share_number"] = None

    if "ps_id" in changes and changes["ps_id"] != member.ps_id:
        station = db.get(PoliceStation, changes["ps_id"])
        if not station or not station.is_active:
            return None, "Select an existing active police station."

    if "mf_id" in changes and changes["mf_id"] != member.mf_id:
        fee_tier = db.get(MembershipFee, changes["mf_id"])
        if not fee_tier or not fee_tier.is_active:
            return None, "Select an existing active membership fee tier."

    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(member, field, value)

    db.commit()
    db.refresh(member)
    return member, ""


def set_member_status(db: Session, kgid: str, status: str) -> Optional[User]:
    """Set a member's status without deleting any member data."""
    member = db.get(User, kgid.strip())
    if not member:
        return None
    member.status = status
    db.commit()
    db.refresh(member)
    return member


def get_members(
    db: Session,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    ps_id: Optional[int] = None,
    status: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieves paginated list of members with search by KGID, name, buckle number, or station."""
    stmt = (
        select(User, PoliceStation.station_name)
        .join(PoliceStation, User.ps_id == PoliceStation.ps_id)
    )

    if ps_id and isinstance(ps_id, int):
        stmt = stmt.where(User.ps_id == ps_id)

    if status and isinstance(status, str) and status.strip():
        stmt = stmt.where(User.status == status.strip())

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.kgid).like(term),
                func.lower(User.full_name).like(term),
                func.lower(User.buckle_number).like(term),
                func.lower(PoliceStation.station_name).like(term),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar() or 0

    # Paginate
    stmt = stmt.order_by(User.created_at.desc())
    stmt = stmt.offset((page - 1) * size).limit(size)

    rows = db.execute(stmt).all()
    results = []
    for user_obj, station_name in rows:
        results.append({
            "kgid": user_obj.kgid,
            "share_number": user_obj.share_number,
            "buckle_number": user_obj.buckle_number,
            "full_name": user_obj.full_name,
            "designation": user_obj.designation,
            "ps_id": user_obj.ps_id,
            "police_station_name": station_name,
            "bank_account_masked": mask_bank_account(user_obj.bank_account_number),
            "ifsc_code": user_obj.ifsc_code,
            "dob": user_obj.dob,
            "gender": user_obj.gender,
            "caste": user_obj.caste,
            "sub_caste": user_obj.sub_caste,
            "category": user_obj.category,
            "financial_year": user_obj.financial_year,
            "financial_month": user_obj.financial_month,
            "status": user_obj.status,
            "mf_id": user_obj.mf_id,
            "created_at": user_obj.created_at,
            "updated_at": user_obj.updated_at,
        })

    return results, total


def get_member_by_kgid(db: Session, kgid: str) -> Optional[Dict[str, Any]]:
    """Fetches complete member profile by KGID including station name."""
    stmt = (
        select(User, PoliceStation.station_name)
        .join(PoliceStation, User.ps_id == PoliceStation.ps_id)
        .where(User.kgid == kgid.strip())
    )
    row = db.execute(stmt).first()
    if not row:
        return None

    user_obj, station_name = row
    return {
        "kgid": user_obj.kgid,
        "share_number": user_obj.share_number,
        "buckle_number": user_obj.buckle_number,
        "full_name": user_obj.full_name,
        "designation": user_obj.designation,
        "ps_id": user_obj.ps_id,
        "police_station_name": station_name,
        "bank_account_number": user_obj.bank_account_number,
        "bank_account_masked": mask_bank_account(user_obj.bank_account_number),
        "ifsc_code": user_obj.ifsc_code,
        "dob": user_obj.dob,
        "gender": user_obj.gender,
        "caste": user_obj.caste,
        "sub_caste": user_obj.sub_caste,
        "category": user_obj.category,
        "financial_year": user_obj.financial_year,
        "financial_month": user_obj.financial_month,
        "status": user_obj.status,
        "mf_id": user_obj.mf_id,
        "created_at": user_obj.created_at,
        "updated_at": user_obj.updated_at,
    }


def list_membership_fees(db: Session) -> List[MembershipFee]:
    """Returns all active membership fee tiers."""
    stmt = select(MembershipFee).where(MembershipFee.is_active.is_(True)).order_by(MembershipFee.mf_id.asc())
    return list(db.execute(stmt).scalars().all())


def create_membership_fee_tier(db: Session, payload: MembershipFeeCreate) -> MembershipFee:
    """Creates a new membership fee tier."""
    fee = MembershipFee(
        share_subscription_fee=payload.share_subscription_fee,
        share_fee=payload.share_fee,
        membership_fee=payload.membership_fee,
        description=payload.description,
        is_active=True,
    )
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return fee
