"""Database aggregations for administrative reporting."""
from calendar import monthrange
from datetime import date, datetime, time, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.loan import Loan
from app.models.loan_payment import LoanPayment
from app.models.user import User

REPORT_TIMEZONE = ZoneInfo("Asia/Kolkata")
ZERO = Decimal("0.00")


def _period_bounds(year: int, month: int | None) -> tuple[date, date, datetime, datetime]:
    if month is None:
        start_date = date(year, 1, 1)
        end_date = date(year + 1, 1, 1)
    else:
        start_date = date(year, month, 1)
        end_date = date(year + (month == 12), month % 12 + 1, 1)

    start_utc = datetime.combine(start_date, time.min, REPORT_TIMEZONE).astimezone(timezone.utc)
    end_utc = datetime.combine(end_date, time.min, REPORT_TIMEZONE).astimezone(timezone.utc)
    return start_date, end_date, start_utc, end_utc


def _as_local_date(value: date | datetime) -> date:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(REPORT_TIMEZONE).date()
    return value


def _period_key(value: date, month: int | None) -> str:
    if month is None:
        return f"{value.year:04d}-{value.month:02d}"
    return f"W{(value.day - 1) // 7 + 1}"


def _new_aggregate() -> dict:
    return {
        "membership_count": 0,
        "loan_count": 0,
        "sanctioned_amount": ZERO,
        "recovered_amount": ZERO,
    }


def _label(value: str | None) -> str:
    return value.strip() if value and value.strip() else "Not specified"


def _add_dimension(groups: dict, label: str, key: str, amount: Decimal = ZERO) -> None:
    group = groups.setdefault(label, _new_aggregate())
    if key == "membership_count":
        group[key] += 1
    elif key == "loan_count":
        group[key] += 1
        group["sanctioned_amount"] += amount
    elif key == "recovered_amount":
        group[key] += amount


def get_report_analytics(db: Session, year: int, month: int | None = None) -> dict:
    """Return period activity, current loan balances, and demographic summaries."""
    start_date, end_date, start_utc, end_utc = _period_bounds(year, month)

    member_rows = db.query(
        User.gender, User.caste, User.status, User.created_at
    ).filter(
        User.created_at >= start_utc,
        User.created_at < end_utc,
    ).all()
    loan_rows = db.query(
        Loan.sanction_date,
        Loan.sanction_amount,
        User.gender,
        User.caste,
    ).join(User, Loan.kgid == User.kgid).filter(
        Loan.sanction_date >= start_date,
        Loan.sanction_date < end_date,
    ).all()
    payment_rows = db.query(
        LoanPayment.payment_date,
        LoanPayment.recovered_amount,
        User.gender,
        User.caste,
    ).join(User, LoanPayment.kgid == User.kgid).filter(
        LoanPayment.is_paid.is_(True),
        LoanPayment.payment_date >= start_date,
        LoanPayment.payment_date < end_date,
    ).all()

    bucket_count = 12 if month is None else monthrange(year, month)[1] // 7 + (monthrange(year, month)[1] % 7 > 0)
    trend = {}
    for index in range(bucket_count):
        key = f"{year:04d}-{index + 1:02d}" if month is None else f"W{index + 1}"
        trend[key] = _new_aggregate()

    gender_groups = {}
    caste_groups = {}
    active_members = 0

    for gender, caste, status, created_at in member_rows:
        local_date = _as_local_date(created_at)
        trend[_period_key(local_date, month)]["membership_count"] += 1
        if (status or "").casefold() == "active":
            active_members += 1
        _add_dimension(gender_groups, _label(gender), "membership_count")
        _add_dimension(caste_groups, _label(caste), "membership_count")

    sanctioned_amount = ZERO
    for sanction_date, amount, gender, caste in loan_rows:
        value = Decimal(amount or ZERO)
        trend[_period_key(sanction_date, month)]["loan_count"] += 1
        trend[_period_key(sanction_date, month)]["sanctioned_amount"] += value
        sanctioned_amount += value
        _add_dimension(gender_groups, _label(gender), "loan_count", value)
        _add_dimension(caste_groups, _label(caste), "loan_count", value)

    recovered_amount = ZERO
    for payment_date, amount, gender, caste in payment_rows:
        value = Decimal(amount or ZERO)
        trend[_period_key(payment_date, month)]["recovered_amount"] += value
        recovered_amount += value
        _add_dimension(gender_groups, _label(gender), "recovered_amount", value)
        _add_dimension(caste_groups, _label(caste), "recovered_amount", value)

    recovered_by_loan = dict(
        db.query(
            LoanPayment.loan_id,
            func.coalesce(func.sum(LoanPayment.recovered_amount), ZERO),
        ).filter(
            LoanPayment.is_paid.is_(True),
        ).group_by(LoanPayment.loan_id).all()
    )
    portfolio_rows = db.query(Loan.loan_id, Loan.sanction_amount, Loan.status).all()
    outstanding_amount = ZERO
    open_loans = 0
    closed_loans = 0
    for loan_id, amount, status in portfolio_rows:
        outstanding_amount += max(ZERO, Decimal(amount or ZERO) - recovered_by_loan.get(loan_id, ZERO))
        if (status or "").casefold() == "closed":
            closed_loans += 1
        else:
            open_loans += 1

    def sorted_groups(groups: dict) -> list[dict]:
        return [
            {"label": label, **values}
            for label, values in sorted(groups.items(), key=lambda item: (-item[1]["membership_count"], item[0].casefold()))
        ]

    return {
        "year": year,
        "month": month,
        "summary": {
            "membership_count": len(member_rows),
            "active_members": active_members,
            "loan_count": len(loan_rows),
            "sanctioned_amount": sanctioned_amount,
            "recovered_amount": recovered_amount,
            "outstanding_amount": outstanding_amount,
            "open_loans": open_loans,
            "closed_loans": closed_loans,
        },
        "trend": [{"period": key, **values} for key, values in trend.items()],
        "gender_breakdown": sorted_groups(gender_groups),
        "caste_breakdown": sorted_groups(caste_groups),
    }