"""Service layer for Loan Management and Loan Payment Transactions."""
from decimal import Decimal, ROUND_CEILING
from datetime import date
import re
from calendar import monthrange
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, desc, and_
from app.models.loan import Loan
from app.models.loan_payment import LoanPayment
from app.models.user import User
from app.models.police_station import PoliceStation
from app.models.enums import LoanTypeEnum
from app.schemas.loan import LoanCreate, LoanUpdate, LoanPaymentCreate
from app.services import user_service


def _build_loan_dict(
    loan: Loan,
    user: User,
    station: PoliceStation,
    total_recovered: Decimal,
    total_interest_paid: Decimal,
    paid_installments: int,
) -> Dict[str, Any]:
    """Formats a Loan row with member, station, and payment aggregate fields."""
    recovered = total_recovered or Decimal("0.00")
    interest_paid = total_interest_paid or Decimal("0.00")
    outstanding = max(Decimal("0.00"), loan.sanction_amount - recovered)
    loan_type_val = loan.loan_type.value if hasattr(loan.loan_type, "value") else str(loan.loan_type)

    return {
        "loan_id": loan.loan_id,
        "kgid": loan.kgid,
        "ps_id": loan.ps_id,
        "loan_type": loan_type_val,
        "sanction_date": loan.sanction_date,
        "sanction_amount": loan.sanction_amount,
        "monthly_principal": loan.monthly_principal,
        "monthly_interest": loan.monthly_interest,
        "interest_rate": getattr(loan, "interest_rate", Decimal("0.0000")),
        "start_month": loan.start_month,
        "end_date": loan.end_date,
        "total_installments": loan.total_installments,
        "document_attachment": loan.document_attachment,
        "status": loan.status,
        "created_at": loan.created_at,
        "updated_at": loan.updated_at,
        "full_name": user.full_name,
        "designation": user.designation,
        "buckle_number": user.buckle_number,
        "share_number": user.share_number,
        "station_name": station.station_name,
        "total_recovered": recovered,
        "outstanding_balance": outstanding,
        "total_interest_paid": interest_paid,
        "paid_installments": paid_installments or 0,
    }


def create_loan(db: Session, payload: LoanCreate) -> Tuple[Optional[Loan], str]:
    """Creates a new sanctioned/active loan for an existing police personnel member."""
    kgid_clean = payload.kgid.strip()
    user = db.get(User, kgid_clean)
    if not user:
        return None, f"Member with KGID '{kgid_clean}' not found."

    target_ps_id = payload.ps_id if payload.ps_id else user.ps_id
    station = db.get(PoliceStation, target_ps_id)
    if not station:
        return None, f"Police Station with ID {target_ps_id} does not exist."

    if payload.monthly_principal <= Decimal("0.00"):
        return None, "Monthly principal must be greater than zero."

    calculated_installments = int(
        (payload.sanction_amount / payload.monthly_principal).to_integral_value(rounding="ROUND_CEILING")
    )

    if payload.total_installments != calculated_installments:
        return None, f"Total installments must be {calculated_installments} for this sanction and monthly principal."

    start_match = re.match(r"^(\d{4})-(\d{2})(?:-(\d{2}))?$", payload.start_month.strip())
    if start_match:
        start_year = int(start_match.group(1))
        start_month_number = int(start_match.group(2))
    else:
        month_match = re.match(r"^([A-Za-z]+)\s+(\d{4})$", payload.start_month.strip())
        month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        if not month_match:
            return None, "Start month must be YYYY-MM or Month YYYY."
        try:
            start_month_number = month_names.index(month_match.group(1).capitalize()) + 1
        except ValueError:
            return None, "Invalid start month."
        start_year = int(month_match.group(2))

    end_month_index = (start_month_number - 1) + (calculated_installments - 1)
    end_year = start_year + (end_month_index // 12)
    end_month_number = (end_month_index % 12) + 1
    calculated_end_date = date(
        end_year,
        end_month_number,
        min(payload.sanction_date.day, monthrange(end_year, end_month_number)[1]),
    )

    if payload.end_date != calculated_end_date:
        return None, f"End date must be {calculated_end_date.isoformat()} for this schedule."

    if payload.end_date < payload.sanction_date:
        return None, "End date cannot be earlier than sanction date."

    new_loan = Loan(
        kgid=kgid_clean,
        ps_id=target_ps_id,
        loan_type=payload.loan_type,
        sanction_date=payload.sanction_date,
        sanction_amount=payload.sanction_amount,
        monthly_principal=payload.monthly_principal,
        monthly_interest=payload.monthly_interest,
        interest_rate=payload.interest_rate,
        start_month=payload.start_month,
        end_date=payload.end_date,
        total_installments=payload.total_installments,
        document_attachment=payload.document_attachment.strip() if payload.document_attachment else None,
        status=payload.status,
    )

    db.add(new_loan)
    db.flush()

    opening_balance = new_loan.sanction_amount
    for installment_number in range(1, new_loan.total_installments + 1):
        opening_advance = opening_balance
        recovery_amount = min(new_loan.monthly_principal, opening_advance)
        cutoff_interest = (
            opening_advance * new_loan.interest_rate / Decimal("1200")
        ).quantize(Decimal("0.01"))
        balance = max(Decimal("0.00"), opening_advance - recovery_amount)

        schedule_row = LoanPayment(
            kgid=new_loan.kgid,
            loan_id=new_loan.loan_id,
            installment_number=installment_number,
            opening_advance=opening_advance,
            recovered_amount=recovery_amount,
            balance=balance,
            total_interest=cutoff_interest,
            payable_amount=recovery_amount + cutoff_interest,
            paid_amount=Decimal("0.00"),
            is_paid=False,
            status="Projected",
            payment_date=None,
        )
        db.add(schedule_row)
        opening_balance = balance

    db.commit()
    db.refresh(new_loan)
    return new_loan, ""


def get_loans(
    db: Session,
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    ps_id: Optional[int] = None,
    loan_type: Optional[str] = None,
    status: Optional[str] = None,
    kgid: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Lists loans with pagination, filtering, and payment recovery aggregates."""
    payment_agg = (
        select(
            LoanPayment.loan_id,
            func.coalesce(func.sum(LoanPayment.recovered_amount), Decimal("0.00")).label("total_recovered"),
            func.coalesce(func.sum(LoanPayment.total_interest), Decimal("0.00")).label("total_interest_paid"),
            func.count(LoanPayment.pay_id).label("paid_installments"),
        )
        .where(LoanPayment.is_paid.is_(True))
        .group_by(LoanPayment.loan_id)
        .subquery()
    )

    base_stmt = (
        select(
            Loan,
            User,
            PoliceStation,
            func.coalesce(payment_agg.c.total_recovered, Decimal("0.00")).label("total_recovered"),
            func.coalesce(payment_agg.c.total_interest_paid, Decimal("0.00")).label("total_interest_paid"),
            func.coalesce(payment_agg.c.paid_installments, 0).label("paid_installments"),
        )
        .join(User, Loan.kgid == User.kgid)
        .join(PoliceStation, Loan.ps_id == PoliceStation.ps_id)
        .outerjoin(payment_agg, Loan.loan_id == payment_agg.c.loan_id)
    )

    count_stmt = (
        select(func.count(Loan.loan_id))
        .join(User, Loan.kgid == User.kgid)
        .join(PoliceStation, Loan.ps_id == PoliceStation.ps_id)
    )

    filters = []
    if ps_id:
        filters.append(Loan.ps_id == ps_id)
    if status and status.strip():
        filters.append(Loan.status == status.strip())
    if kgid and kgid.strip():
        filters.append(Loan.kgid == kgid.strip())
    if loan_type and loan_type.strip():
        try:
            enum_val = LoanTypeEnum(loan_type.strip())
            filters.append(Loan.loan_type == enum_val)
        except ValueError:
            pass
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Loan.kgid.ilike(term),
                User.full_name.ilike(term),
                User.designation.ilike(term),
                PoliceStation.station_name.ilike(term),
            )
        )

    if filters:
        base_stmt = base_stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    total = db.execute(count_stmt).scalar() or 0
    offset = (page - 1) * size

    rows = db.execute(
        base_stmt.order_by(desc(Loan.sanction_date), desc(Loan.loan_id))
        .offset(offset)
        .limit(size)
    ).all()

    items = [
        _build_loan_dict(loan, user, station, total_rec, total_int, paid_cnt)
        for loan, user, station, total_rec, total_int, paid_cnt in rows
    ]
    return items, total


def get_loan_by_id(db: Session, loan_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single enriched loan record."""
    payment_agg = (
        select(
            LoanPayment.loan_id,
            func.coalesce(func.sum(LoanPayment.recovered_amount), Decimal("0.00")).label("total_recovered"),
            func.coalesce(func.sum(LoanPayment.total_interest), Decimal("0.00")).label("total_interest_paid"),
            func.count(LoanPayment.pay_id).label("paid_installments"),
        )
        .where(LoanPayment.loan_id == loan_id, LoanPayment.is_paid.is_(True))
        .group_by(LoanPayment.loan_id)
        .subquery()
    )

    row = db.execute(
        select(
            Loan,
            User,
            PoliceStation,
            func.coalesce(payment_agg.c.total_recovered, Decimal("0.00")),
            func.coalesce(payment_agg.c.total_interest_paid, Decimal("0.00")),
            func.coalesce(payment_agg.c.paid_installments, 0),
        )
        .join(User, Loan.kgid == User.kgid)
        .join(PoliceStation, Loan.ps_id == PoliceStation.ps_id)
        .outerjoin(payment_agg, Loan.loan_id == payment_agg.c.loan_id)
        .where(Loan.loan_id == loan_id)
    ).first()

    if not row:
        return None
    loan, user, station, total_rec, total_int, paid_cnt = row
    return _build_loan_dict(loan, user, station, total_rec, total_int, paid_cnt)


def update_loan(db: Session, loan_id: int, payload: LoanUpdate) -> Tuple[Optional[Loan], str]:
    """Updates an existing loan record."""
    loan = db.get(Loan, loan_id)
    if not loan:
        return None, "Loan record not found."

    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "ps_id" in changes:
        station = db.get(PoliceStation, changes["ps_id"])
        if not station:
            return None, f"Police Station with ID {changes['ps_id']} does not exist."

    for field, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(loan, field, value)

    if loan.monthly_principal <= Decimal("0.00"):
        return None, "Monthly principal must be greater than zero."

    calculated_installments = int(
        (loan.sanction_amount / loan.monthly_principal).to_integral_value(rounding="ROUND_CEILING")
    )
    loan.total_installments = calculated_installments

    if loan.end_date < loan.sanction_date:
        return None, "End date cannot be earlier than sanction date."

    db.commit()
    db.refresh(loan)
    return loan, ""


def record_loan_payment(
    db: Session,
    loan_id: int,
    payload: LoanPaymentCreate,
    commit: bool = True,
) -> Tuple[Optional[LoanPayment], str]:
    """Records an installment payment and automatically calculates remaining balance."""
    loan = db.get(Loan, loan_id)
    if not loan:
        return None, "Loan record not found."

    unpaid_installment = db.execute(
        select(LoanPayment.installment_number)
        .where(LoanPayment.loan_id == loan_id, LoanPayment.is_paid.is_(False))
        .order_by(LoanPayment.installment_number.asc())
        .limit(1)
    ).scalar_one_or_none()
    schedule_count = db.query(LoanPayment).filter_by(loan_id=loan_id).count()
    next_installment = unpaid_installment or schedule_count + 1
    target_installment = payload.installment_number or next_installment
    if target_installment != next_installment:
        return None, f"Installments must be processed in order. The next installment is #{next_installment}."
    if target_installment > loan.total_installments:
        return None, "All scheduled installments have already been processed."

    prev_recovered = db.execute(
        select(func.coalesce(func.sum(LoanPayment.recovered_amount), Decimal("0.00")))
        .where(LoanPayment.loan_id == loan_id, LoanPayment.is_paid.is_(True))
    ).scalar() or Decimal("0.00")

    opening_balance = max(Decimal("0.00"), loan.sanction_amount - prev_recovered)

    # Cutoff interest: opening balance x annual rate / 12 / 100.
    if loan.sanction_amount > Decimal("0.00"):
        annual_rate_percent = getattr(loan, "interest_rate", Decimal("0.0000"))
        calculated_interest = (
            opening_balance * annual_rate_percent
            / Decimal("1200")
        ).quantize(Decimal("0.01"))
    else:
        calculated_interest = Decimal("0.00")

    # The reference schedule always recovers the fixed monthly principal.
    principal_recovery = min(loan.monthly_principal, opening_balance)
    new_total_recovered = prev_recovered + principal_recovery
    new_balance = max(Decimal("0.00"), loan.sanction_amount - new_total_recovered)

    schedule_query = select(LoanPayment).where(
        LoanPayment.loan_id == loan_id,
        LoanPayment.is_paid.is_(False),
    )
    if payload.installment_number is not None:
        schedule_query = schedule_query.where(
            LoanPayment.installment_number == payload.installment_number
        )
    schedule_row = db.execute(
        schedule_query.order_by(LoanPayment.installment_number.asc()).limit(1)
    ).scalar_one_or_none()

    if schedule_row:
        schedule_row.recovered_amount = principal_recovery if payload.is_paid else Decimal("0.00")
        schedule_row.balance = new_balance if payload.is_paid else opening_balance
        schedule_row.total_interest = calculated_interest
        schedule_row.payable_amount = principal_recovery + calculated_interest
        schedule_row.paid_amount = (payload.paid_amount or principal_recovery + calculated_interest) if payload.is_paid else Decimal("0.00")
        schedule_row.is_paid = payload.is_paid
        schedule_row.status = payload.status.strip() if payload.is_paid else (
            "Due" if payload.status.strip().lower() == "due" else "Not Received"
        )
        schedule_row.payment_date = payload.payment_date if payload.is_paid else None
    else:
        payment = LoanPayment(
            kgid=loan.kgid,
            loan_id=loan.loan_id,
            installment_number=(db.query(LoanPayment).filter_by(loan_id=loan_id).count() + 1),
            opening_advance=opening_balance,
            recovered_amount=principal_recovery,
            balance=new_balance,
            total_interest=calculated_interest,
            payable_amount=principal_recovery + calculated_interest,
            paid_amount=payload.paid_amount or principal_recovery + calculated_interest,
            is_paid=True,
            status=payload.status.strip(),
            payment_date=payload.payment_date,
        )
        db.add(payment)

    # Update loan status automatically based on remaining balance
    if payload.is_paid and new_balance == Decimal("0.00"):
        loan.status = "Closed"
    elif loan.status == "Sanctioned":
        loan.status = "Active"

    if commit:
        db.commit()
    if schedule_row:
        if commit:
            db.refresh(schedule_row)
        return schedule_row, ""
    if commit:
        db.refresh(payment)
    return payment, ""


def _installment_for_month(start_month: str, year: int, month: int) -> Optional[int]:
    start_text = str(start_month or "").strip()
    iso_match = re.match(r"^(\d{4})[-/](\d{1,2})", start_text)
    name_match = re.match(r"^([A-Za-z]+)\s+(\d{4})$", start_text)
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]

    if iso_match:
        start_year = int(iso_match.group(1))
        start_month_number = int(iso_match.group(2))
    elif name_match:
        start_year = int(name_match.group(2))
        month_name = name_match.group(1).replace(".", "").lower()
        start_month_number = next(
            (index for index, name in enumerate(month_names, 1) if name.lower().startswith(month_name)),
            0,
        )
    else:
        return None

    if not 1 <= start_month_number <= 12:
        return None
    return (year - start_year) * 12 + month - start_month_number + 1


def get_monthly_schedules(
    db: Session,
    month: str,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 100,
    status_filter: Optional[str] = None,
    ps_id: Optional[int] = None,
    loan_type: Optional[LoanTypeEnum] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Lists each open loan's installment scheduled for a selected month."""
    year, month_number = (int(part) for part in month.split("-"))
    stmt = (
        select(Loan, User, PoliceStation)
        .join(User, Loan.kgid == User.kgid)
        .join(PoliceStation, Loan.ps_id == PoliceStation.ps_id)
        .where(Loan.status != "Closed")
    )
    if ps_id:
        stmt = stmt.where(Loan.ps_id == ps_id)
    if loan_type:
        stmt = stmt.where(Loan.loan_type == loan_type)
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(
            Loan.kgid.ilike(term),
            User.full_name.ilike(term),
            User.designation.ilike(term),
            User.buckle_number.ilike(term),
            PoliceStation.station_name.ilike(term),
        ))

    loan_rows = db.execute(stmt.order_by(desc(Loan.sanction_date), desc(Loan.loan_id))).all()
    eligible = []
    for loan, user, station in loan_rows:
        installment_number = _installment_for_month(loan.start_month, year, month_number)
        if installment_number is not None and 1 <= installment_number <= loan.total_installments:
            eligible.append((loan, user, station, installment_number))

    offset = (page - 1) * size
    if status_filter:
        all_items = []
        for start in range(0, len(eligible), 200):
            all_items.extend(_build_monthly_schedule_items(db, eligible[start:start + 200]))
        if status_filter == "Upcoming":
            all_items = [item for item in all_items if item["status"] == "Upcoming"]
        elif status_filter == "Due":
            all_items = [item for item in all_items if item["status"] == "Due"]
        elif status_filter == "Received":
            all_items = [item for item in all_items if item["is_paid"]]
        elif status_filter == "Waiting":
            all_items = [item for item in all_items if item["status"].startswith("Waiting for installment #")]
        elif status_filter == "Missing":
            all_items = [item for item in all_items if item["status"] == "Schedule missing"]
        total = len(all_items)
        return all_items[offset:offset + size], total

    total = len(eligible)
    page_rows = eligible[offset:offset + size]
    return _build_monthly_schedule_items(db, page_rows), total


def _build_monthly_schedule_items(
    db: Session,
    schedule_rows: List[Tuple[Loan, User, PoliceStation, int]],
) -> List[Dict[str, Any]]:
    if not schedule_rows:
        return []

    payment_conditions = [
        and_(LoanPayment.loan_id == loan.loan_id, LoanPayment.installment_number == installment_number)
        for loan, _, _, installment_number in schedule_rows
    ]
    payments = db.execute(select(LoanPayment).where(or_(*payment_conditions))).scalars().all()
    payments_by_schedule = {(payment.loan_id, payment.installment_number): payment for payment in payments}
    loan_ids = [loan.loan_id for loan, _, _, _ in schedule_rows]
    paid_recoveries = db.execute(
        select(
            LoanPayment.loan_id,
            func.coalesce(func.sum(LoanPayment.recovered_amount), Decimal("0.00")),
        )
        .where(LoanPayment.loan_id.in_(loan_ids), LoanPayment.is_paid.is_(True))
        .group_by(LoanPayment.loan_id)
    ).all()
    recovered_by_loan = {loan_id: recovered for loan_id, recovered in paid_recoveries}
    prior_unpaid_conditions = [
        and_(
            LoanPayment.loan_id == loan.loan_id,
            LoanPayment.installment_number <= installment_number,
            LoanPayment.is_paid.is_(False),
        )
        for loan, _, _, installment_number in schedule_rows
    ]
    prior_unpaid_rows = db.execute(
        select(LoanPayment.loan_id, LoanPayment.installment_number)
        .where(or_(*prior_unpaid_conditions))
        .order_by(LoanPayment.installment_number.asc())
    ).all()
    first_unpaid_by_loan = {}
    for loan_id, installment_number in prior_unpaid_rows:
        first_unpaid_by_loan.setdefault(loan_id, installment_number)

    items = []
    for loan, user, station, installment_number in schedule_rows:
        payment = payments_by_schedule.get((loan.loan_id, installment_number))
        can_mark = bool(
            payment
            and not payment.is_paid
            and first_unpaid_by_loan.get(loan.loan_id) == installment_number
        )
        opening_balance = max(
            Decimal("0.00"),
            loan.sanction_amount - recovered_by_loan.get(loan.loan_id, Decimal("0.00")),
        )
        scheduled_principal = min(loan.monthly_principal, opening_balance)
        scheduled_interest = (
            opening_balance * loan.interest_rate / Decimal("1200")
        ).quantize(Decimal("0.01"))
        items.append({
            "loan_id": loan.loan_id,
            "kgid": loan.kgid,
            "full_name": user.full_name,
            "designation": user.designation,
            "station_name": station.station_name,
            "loan_type": loan.loan_type.value if hasattr(loan.loan_type, "value") else str(loan.loan_type),
            "installment_number": installment_number,
            "scheduled_amount": scheduled_principal + scheduled_interest,
            "status": (
                "Paid" if payment and payment.is_paid
                else "Schedule missing" if not payment
                else f"Waiting for installment #{first_unpaid_by_loan[loan.loan_id]}" if not can_mark
                else "Due" if payment.status in ("Due", "Not Received")
                else "Upcoming"
            ),
            "is_paid": bool(payment and payment.is_paid),
            "can_mark": can_mark,
            "next_installment_number": first_unpaid_by_loan.get(loan.loan_id),
        })
    return items


def bulk_update_monthly_schedules(
    db: Session,
    month: str,
    loan_ids: List[int],
    target_status: str,
) -> Tuple[int, str]:
    """Marks selected loans' month-specific installments as paid or due atomically."""
    year, month_number = (int(part) for part in month.split("-"))
    loans = db.execute(
        select(Loan).where(Loan.loan_id.in_(loan_ids))
    ).scalars().all()
    loans_by_id = {loan.loan_id: loan for loan in loans}
    if len(loans_by_id) != len(set(loan_ids)):
        return 0, "One or more selected loans no longer exist. Refresh the schedule and try again."

    installment_by_loan = {}
    for loan in loans:
        installment_number = _installment_for_month(loan.start_month, year, month_number)
        if loan.status == "Closed" or not installment_number or installment_number > loan.total_installments:
            return 0, f"Loan #{loan.loan_id} has no open installment for {month}."
        installment_by_loan[loan.loan_id] = installment_number

    payment_conditions = [
        and_(
            LoanPayment.loan_id == loan_id,
            LoanPayment.installment_number == installment_number,
        )
        for loan_id, installment_number in installment_by_loan.items()
    ]
    schedule_rows = db.execute(
        select(LoanPayment).where(or_(*payment_conditions))
    ).scalars().all()
    schedules_by_loan = {row.loan_id: row for row in schedule_rows}

    unpaid_rows = db.execute(
        select(LoanPayment.loan_id, LoanPayment.installment_number)
        .where(
            LoanPayment.loan_id.in_(list(installment_by_loan)),
            LoanPayment.is_paid.is_(False),
        )
        .order_by(LoanPayment.installment_number.asc())
    ).all()
    first_unpaid_by_loan = {}
    for loan_id, installment_number in unpaid_rows:
        first_unpaid_by_loan.setdefault(loan_id, installment_number)

    for loan_id, installment_number in installment_by_loan.items():
        schedule_row = schedules_by_loan.get(loan_id)
        if not schedule_row or schedule_row.installment_number != installment_number:
            return 0, f"Loan #{loan_id} is missing its scheduled installment for {month}."
        if schedule_row.is_paid:
            return 0, f"Loan #{loan_id} is already received for {month}. Refresh the schedule and try again."
        if first_unpaid_by_loan.get(loan_id) != installment_number:
            earlier = first_unpaid_by_loan.get(loan_id)
            return 0, f"Loan #{loan_id} must be processed in order. Installment #{earlier} is next."

    payment_date = date(year, month_number, 1)
    for loan_id, installment_number in installment_by_loan.items():
        payload = LoanPaymentCreate(
            installment_number=installment_number,
            is_paid=target_status == "Paid",
            payment_date=payment_date,
            status=target_status,
        )
        payment, error = record_loan_payment(db, loan_id, payload, commit=False)
        if not payment:
            db.rollback()
            return 0, error

    db.commit()
    return len(installment_by_loan), ""


def get_loan_payments(db: Session, loan_id: int) -> List[LoanPayment]:
    """Returns all payment transactions for a specific loan ordered by date."""
    return list(
        db.execute(
            select(LoanPayment)
            .where(LoanPayment.loan_id == loan_id)
            .order_by(LoanPayment.installment_number.asc(), LoanPayment.pay_id.asc())
        ).scalars().all()
    )


def get_user_transactional_history(db: Session, kgid: str) -> Optional[Dict[str, Any]]:
    """Returns full user profile, all their loans, and all payment transactions."""
    user_detail = user_service.get_member_by_kgid(db, kgid.strip())
    if not user_detail:
        return None

    loans, _ = get_loans(db, page=1, size=200, kgid=kgid.strip())
    payments = list(
        db.execute(
            select(LoanPayment)
            .where(LoanPayment.kgid == kgid.strip())
            .order_by(LoanPayment.installment_number.asc(), LoanPayment.pay_id.asc())
        ).scalars().all()
    )

    return {
        "user": user_detail,
        "loans": loans,
        "payments": payments,
    }
