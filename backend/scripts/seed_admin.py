"""Database seeding script for Initial Administrator account and default Fee tier.

Usage:
    python scripts/seed_admin.py
    python scripts/seed_admin.py --reset-password
"""
import sys
import argparse
from decimal import Decimal
from pathlib import Path

# Dynamically locate and add the backend directory containing 'app' to sys.path
_current = Path(__file__).resolve().parent
_search_dirs = [
    _current,
    _current.parent,
    _current.parent / "backend",
    _current.parent.parent,
    _current.parent.parent / "backend",
]
for _dir in _search_dirs:
    if (_dir / "app").is_dir() and str(_dir) not in sys.path:
        sys.path.insert(0, str(_dir))
        break

from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.database.connection import SessionLocal, engine
from app.database.base import Base
from app.models.admin import Admin
from app.models.membership_fee import MembershipFee
# Ensure all models are loaded
import app.models  # noqa: F401


def seed_database(reset_password: bool = False) -> None:
    """Creates tables if not present, seeds the single admin account and initial fee tier."""
    if not settings.INITIAL_ADMIN_USERNAME or not settings.INITIAL_ADMIN_PASSWORD:
        raise RuntimeError(
            "Set INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD in the ignored .env file before seeding."
        )

    print("=" * 70)
    print("SP Office Membership & Fund Management System - Database Seeder")
    print("=" * 70)

    # 1. Ensure tables exist
    print("[1/3] Ensuring database schema exists...")
    Base.metadata.create_all(bind=engine)
    print("      Database tables verified/created successfully.")

    db = SessionLocal()
    try:
        # 2. Seed or update Admin
        print("[2/3] Checking Administrator account...")
        admin_username = settings.INITIAL_ADMIN_USERNAME.strip()
        admin_password = settings.INITIAL_ADMIN_PASSWORD

        existing_admin = db.execute(select(Admin)).scalar_one_or_none()

        if existing_admin:
            if reset_password:
                print(f"      Existing admin '{existing_admin.username}' found. Resetting initial credentials...")
                existing_admin.username = admin_username
                existing_admin.password_hash = hash_password(admin_password)
                existing_admin.must_change_password = True
                existing_admin.is_active = True
                db.add(existing_admin)
                db.commit()
                print(f"      [OK] Admin credentials reset for username: '{admin_username}'.")
                print("      [NOTE] 'must_change_password' flag has been reset to TRUE.")
            else:
                print(f"      [INFO] Administrator '{existing_admin.username}' already exists (ID: {existing_admin.admin_id}).")
                print("             Skipping creation. (Use --reset-password to restore default credentials if needed).")
        else:
            print(f"      Creating initial administrator '{admin_username}'...")
            new_admin = Admin(
                username=admin_username,
                password_hash=hash_password(admin_password),
                is_active=True,
                must_change_password=True,
            )
            db.add(new_admin)
            db.commit()
            print(f"      [OK] Initial administrator created successfully!")
            print(f"           Username: {admin_username}")
            print("           The administrator must change the initial password on first login.")

        # 3. Seed default Membership Fee Tier
        print("[3/3] Checking default Membership Fee tiers...")
        fee_count = db.execute(select(MembershipFee)).first()
        if not fee_count:
            default_fee = MembershipFee(
                share_subscription_fee=Decimal("500.00"),
                share_fee=Decimal("1000.00"),
                membership_fee=Decimal("200.00"),
                description="Standard Police Personnel Membership Tier (Default)",
                is_active=True,
            )
            db.add(default_fee)
            db.commit()
            print(f"      [OK] Default fee tier created (mf_id: {default_fee.mf_id}).")
        else:
            print("      [INFO] Membership fee tier already present.")

        print("=" * 70)
        print("Database seeding completed successfully.")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed initial Administrator account.")
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Reset existing admin password back to INITIAL_ADMIN_PASSWORD from .env",
    )
    args = parser.parse_args()
    seed_database(reset_password=args.reset_password)
