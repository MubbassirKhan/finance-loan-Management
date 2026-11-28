"""Service layer for Police Personnel Members and Membership Fees."""
from datetime import date, datetime
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from app.models.user import User
from app.models.police_station import PoliceStation
from app.models.membership_fee import MembershipFee
from app.models.membership_record import MembershipRecord
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.membership_fee import MembershipFeeCreate, MembershipFeeStatusUpdate, MembershipFeeUpdate


def mask_bank_account(account_number: str) -> str:
    """Masks all but the last 4 digits of a bank account number for privacy."""
    clean = account_number.strip()
    if len(clean) <= 4:
        return "****"
    return "*" * (len(clean) - 4) + clean[-4:]


def is_kgid_available(db: Session, kgid: str) -> bool:
    """Check KGID uniqueness without exposing a member profile."""
    return db.get(User, kgid.strip()) is None


def is_member_field_available(
    db: Session,
    field_name: str,
    value: str,
    exclude_kgid: Optional[str] = None,
) -> bool:
    """Check share or buckle identifiers without returning member details."""
    field = {
        "share_number": User.share_number,
        "buckle_number": User.buckle_number,
    }.get(field_name)
    if field is None:
        raise ValueError(f"Unsupported unique member field: {field_name}")

    stmt = select(User.kgid).where(field == value.strip())
    if exclude_kgid:
        stmt = stmt.where(User.kgid != exclude_kgid.strip())
    return db.execute(stmt.limit(1)).scalar_one_or_none() is None


def _financial_period_for_date(value: date) -> Tuple[str, str]:
    """Derive legacy financial period fields from a membership effective date."""
    financial_year_start = value.year if value.month >= 4 else value.year - 1
    financial_year = f"{financial_year_start}-{(financial_year_start + 1) % 100:02d}"
    return financial_year, value.strftime("%B")


def _legacy_membership_start_date(member: User) -> date:
    """Recover a legacy member's start month from existing financial-period fields."""
    try:
        fiscal_start_year = int(member.financial_year.split("-")[0][:4])
        try:
            month_number = datetime.strptime(member.financial_month.strip(), "%B").month
        except ValueError:
            month_number = datetime.strptime(member.financial_month.strip(), "%b").month
        calendar_year = fiscal_start_year + (1 if month_number < 4 else 0)
        return date(calendar_year, month_number, 1)
    except (AttributeError, TypeError, ValueError):
        return member.created_at.date() if member.created_at else date.today()


def _add_membership_assignment(db: Session, kgid: str, mf_id: int, effective_from: date) -> MembershipRecord:
    record = MembershipRecord(
        kgid=kgid,
        mf_id=mf_id,
        record_type="membership",
        effective_from=effective_from,
    )
    db.add(record)
    return record


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

    # 2. Check Share and Buckle Number uniqueness if provided
    if payload.share_number:
        share_clean = payload.share_number.strip()
        if not is_member_field_available(db, "share_number", share_clean):
            return None, f"Share Number '{share_clean}' is already assigned to another member."

    if payload.buckle_number:
        buckle_clean = payload.buckle_number.strip()
        if not is_member_field_available(db, "buckle_number", buckle_clean):
            return None, f"Buckle Number '{buckle_clean}' is already assigned to another member."

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

    membership_start_date = payload.membership_start_date or date.today()
    if membership_start_date > date.today():
        return None, "Membership start date cannot be in the future."
    financial_year, financial_month = _financial_period_for_date(membership_start_date)

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
        financial_year=(payload.financial_year or financial_year).strip(),
        financial_month=(payload.financial_month or financial_month).strip(),
        status="Active",
        mf_id=payload.mf_id,
    )

    db.add(new_user)
    db.flush()
    _add_membership_assignment(db, new_user.kgid, new_user.mf_id, membership_start_date)
    db.flush()
    current_date = date.today()
    generate_missing_membership_subscriptions(db, as_of=current_date, kgid=new_user.kgid)
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
    membership_date_provided = "membership_start_date" in changes
    membership_start_date = changes.pop("membership_start_date", None)
    if membership_start_date and membership_start_date > date.today():
        return None, "Membership start date cannot be in the future."
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

    buckle_number = changes.get("buckle_number")
    if buckle_number:
        buckle_number = buckle_number.strip()
        if not is_member_field_available(db, "buckle_number", buckle_number, member.kgid):
            return None, f"Buckle Number '{buckle_number}' is already assigned to another member."
        changes["buckle_number"] = buckle_number
    elif "buckle_number" in changes:
        changes["buckle_number"] = None

    if "ps_id" in changes and changes["ps_id"] != member.ps_id:
        station = db.get(PoliceStation, changes["ps_id"])
        if not station or not station.is_active:
            return None, "Select an existing active police station."

    tier_changed = "mf_id" in changes and changes["mf_id"] != member.mf_id
    membership_effective_date = membership_start_date or date.today()
    new_membership_fee = None
    if tier_changed:
        fee_tier = db.get(MembershipFee, changes["mf_id"])
        if not fee_tier or not fee_tier.is_active:
            return None, "Select an existing active membership fee tier."
        new_membership_fee = fee_tier

    active_assignment = None
    if tier_changed or membership_date_provided:
        active_assignment = db.execute(
            select(MembershipRecord)
            .where(
                MembershipRecord.kgid == member.kgid,
                MembershipRecord.record_type == "membership",
                MembershipRecord.expires_at.is_(None),
            )
            .with_for_update()
        ).scalar_one_or_none()
        if tier_changed and active_assignment:
            if membership_effective_date < active_assignment.effective_from:
                return None, "Membership start date cannot precede the current tier's start date."
            active_assignment.expires_at = membership_effective_date
        elif tier_changed:
            _add_membership_assignment(
                db,
                member.kgid,
                member.mf_id,
                member.created_at.date() if member.created_at else membership_effective_date,
            ).expires_at = membership_effective_date
        if tier_changed:
            db.flush()

    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(member, field, value)

    if tier_changed and new_membership_fee:
        _add_membership_assignment(db, member.kgid, new_membership_fee.mf_id, membership_effective_date)
    elif membership_date_provided and active_assignment:
        active_assignment.effective_from = membership_effective_date
    elif membership_date_provided:
        _add_membership_assignment(db, member.kgid, member.mf_id, membership_effective_date)

    if membership_date_provided or tier_changed:
        member.financial_year, member.financial_month = _financial_period_for_date(membership_effective_date)

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
    membership_start_date = db.execute(
        select(MembershipRecord.effective_from).where(
            MembershipRecord.kgid == user_obj.kgid,
            MembershipRecord.record_type == "membership",
            MembershipRecord.expires_at.is_(None),
        )
    ).scalar_one_or_none()
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
        "membership_start_date": membership_start_date,
        "financial_year": user_obj.financial_year,
        "financial_month": user_obj.financial_month,
        "status": user_obj.status,
        "mf_id": user_obj.mf_id,
        "created_at": user_obj.created_at,
        "updated_at": user_obj.updated_at,
    }


def list_membership_fees(db: Session) -> List[MembershipFee]:
    """Returns all fee tiers so inactive tiers can be reactivated."""
    stmt = select(MembershipFee).order_by(MembershipFee.mf_id.asc())
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


def update_membership_fee_tier(
    db: Session,
    mf_id: int,
    payload: MembershipFeeUpdate,
) -> Optional[MembershipFee]:
    """Updates an existing membership fee tier."""
    fee = db.get(MembershipFee, mf_id)
    if not fee:
        return None

    for field, value in payload.model_dump().items():
        setattr(fee, field, value)

    db.commit()
    db.refresh(fee)
    return fee


def update_membership_fee_tier_status(
    db: Session,
    mf_id: int,
    payload: MembershipFeeStatusUpdate,
) -> Optional[MembershipFee]:
    """Activates or marks a fee tier inactive without deleting its record."""
    fee = db.get(MembershipFee, mf_id)
    if not fee:
        return None

    fee.is_active = payload.is_active
    db.commit()
    db.refresh(fee)
    return fee


def list_membership_records(db: Session, kgid: str) -> List[MembershipRecord]:
    """Returns a member's tier history and monthly subscription snapshots."""
    stmt = (
        select(MembershipRecord)
        .where(MembershipRecord.kgid == kgid.strip())
        .order_by(MembershipRecord.created_at.asc(), MembershipRecord.record_id.asc())
    )
    return list(db.execute(stmt).scalars().all())


def generate_monthly_subscriptions(
    db: Session,
    year: int,
    month: int,
    kgid: Optional[str] = None,
    commit: bool = True,
) -> int:
    """Snapshot the tier active during a month, once per active member and period."""
    transaction_date = date(year, month, 1)
    stmt = (
        select(
            User.kgid,
            MembershipRecord.mf_id,
            MembershipFee.share_subscription_fee,
            MembershipRecord.record_id,
        )
        .join(
            MembershipRecord,
            (MembershipRecord.kgid == User.kgid)
            & (MembershipRecord.record_type == "membership")
            & (MembershipRecord.effective_from <= transaction_date)
            & or_(MembershipRecord.expires_at.is_(None), MembershipRecord.expires_at >= transaction_date),
        )
        .join(MembershipFee, MembershipFee.mf_id == MembershipRecord.mf_id)
        .where(User.status == "Active")
        .order_by(User.kgid.asc(), MembershipRecord.effective_from.desc(), MembershipRecord.record_id.desc())
    )
    if kgid:
        stmt = stmt.where(User.kgid == kgid.strip())

    assignment_rows = db.execute(stmt).all()
    eligible_by_member = {}
    for row in assignment_rows:
        eligible_by_member.setdefault(row.kgid, row)
    if not eligible_by_member:
        return 0

    rows = [
        {
            "kgid": member_kgid,
            "mf_id": mf_id,
            "record_type": "subscription",
            "amount": amount,
            "month": month,
            "year": year,
            "transaction_date": transaction_date,
            "membership_record_id": membership_record_id,
        }
        for member_kgid, mf_id, amount, membership_record_id in eligible_by_member.values()
    ]
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = postgresql_insert(MembershipRecord).values(rows).on_conflict_do_nothing()
    elif dialect == "sqlite":
        statement = sqlite_insert(MembershipRecord).values(rows).on_conflict_do_nothing()
    else:
        raise RuntimeError(f"Monthly subscription generation is unsupported for database: {dialect}")

    result = db.execute(statement)
    if commit:
        db.commit()
    return result.rowcount or 0


def generate_missing_membership_subscriptions(
    db: Session,
    as_of: Optional[date] = None,
    kgid: Optional[str] = None,
) -> int:
    """Fill missing monthly ledger entries from each active member's first tier date."""
    cutoff_date = as_of or date.today()
    final_month = date(cutoff_date.year, cutoff_date.month, 1)
    existing_assignments = select(MembershipRecord.kgid).where(
        MembershipRecord.record_type == "membership"
    )
    members_without_history = db.execute(
        select(User).where(~User.kgid.in_(existing_assignments))
    ).scalars().all()
    for member in members_without_history:
        db.add(
            MembershipRecord(
                kgid=member.kgid,
                mf_id=member.mf_id,
                record_type="membership",
                effective_from=_legacy_membership_start_date(member),
            )
        )
    if members_without_history:
        db.flush()

    starts_stmt = (
        select(User.kgid, func.min(MembershipRecord.effective_from))
        .join(MembershipRecord, MembershipRecord.kgid == User.kgid)
        .where(
            User.status == "Active",
            MembershipRecord.record_type == "membership",
            MembershipRecord.effective_from <= cutoff_date,
        )
        .group_by(User.kgid)
    )
    if kgid:
        starts_stmt = starts_stmt.where(User.kgid == kgid.strip())

    total_generated = 0
    member_starts = db.execute(starts_stmt).all()
    for member_kgid, first_start in member_starts:
        target_month = date(first_start.year, first_start.month, 1)
        while target_month <= final_month:
            total_generated += generate_monthly_subscriptions(
                db,
                target_month.year,
                target_month.month,
                kgid=member_kgid,
                commit=False,
            )
            target_month = date(
                target_month.year + (target_month.month // 12),
                target_month.month % 12 + 1,
                1,
            )

    if members_without_history or member_starts:
        db.commit()
    return total_generated
