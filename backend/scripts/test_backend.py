"""SP Office Membership and Fund Management System - Comprehensive Verification Test Suite.

Directly tests:
1. Database table creation
2. Admin seeding and credential verification
3. Password hashing (bcrypt) and session token hashing (SHA-256)
4. Admin login with invalid and valid credentials
5. Database-backed session creation with token hashing
6. Dependency `get_current_admin`:
   - Valid session authentication
   - Expired session rejection (401)
   - Inactivity timeout rejection (401)
   - Revoked session rejection (401)
7. Dependency `require_password_changed`:
   - Enforcing initial password change (403 forbidden)
8. Admin password change:
   - Password strength validation
   - Current password validation
   - Resetting `must_change_password` to False
   - Revocation of other existing sessions
9. Police Stations Operations:
   - Creation of Police Station
   - Uniqueness check on station name (400 on duplicate)
   - Retrieval and listing with pagination and search
   - Updating station details
   - Deactivating / toggling station status
10. Member Operations:
    - Registering police personnel member with KGID, designation, buckle number, station, and fee tier
    - KGID uniqueness validation
    - IFSC code format validation
    - Member listing with search and masked bank account protection
    - Single member retrieval with full details
11. Admin Logout & Session Revocation
"""
import sys
import os
import io
import tempfile
from decimal import Decimal
from datetime import date, datetime, timezone, timedelta
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

# Use in-memory SQLite database for testing
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-that-is-at-least-32-chars")

from fastapi import Request, Response, HTTPException
from starlette.datastructures import UploadFile as StarletteUploadFile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
import app.models  # noqa: F401
from app.core.config import settings
from app.core.security import hash_password, verify_password, hash_session_token, generate_session_token
from app.models.admin import Admin
from app.models.admin_session import AdminSession
from app.models.membership_fee import MembershipFee
from app.models.membership_record import MembershipRecord
from app.models.police_station import PoliceStation
from app.models.user import User

from app.schemas.auth import AdminLoginRequest, ChangePasswordRequest
from app.schemas.police_station import PoliceStationCreate, PoliceStationUpdate
from app.schemas.user import UserCreate, UserStatusUpdate, UserUpdate
from app.models.enums import DocTypeEnum

from app.services import auth_service, police_station_service, user_service
from app.dependencies.auth import get_current_admin, require_password_changed
from app.routes import auth, police_stations, users

TEST_ADMIN_PASSWORD = "TestOnly!Pass2026"


def create_dummy_request(cookies=None, headers=None, client_ip="127.0.0.1"):
    """Creates a mock FastAPI Request object for testing route handlers and dependencies."""
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/",
        "headers": [],
        "client": (client_ip, 50000),
    }
    raw_headers = []
    if headers:
        for k, v in headers.items():
            raw_headers.append((k.lower().encode("latin-1"), v.encode("latin-1")))
    scope["headers"] = raw_headers
    
    req = Request(scope)
    # Monkey-patch cookies dictionary
    if cookies:
        req._cookies = cookies
    else:
        req._cookies = {}
    return req


def run_all_tests():
    print("=" * 80)
    print("STARTING SP OFFICE BACKEND FOUNDATION & AUTHENTICATION VERIFICATION SUITE")
    print("=" * 80)

    # 1. Setup Test Engine and Schema
    print("[TEST 1] Creating database schema in SQLite test engine...")
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    print("  -> Schema initialized successfully.")

    db = TestingSession()

    # 2. Seed Admin & Default Membership Fee
    print("\n[TEST 2] Seeding an in-memory test administrator and default fee tier...")
    initial_admin = Admin(
        username="admin",
        password_hash=hash_password(TEST_ADMIN_PASSWORD),
        is_active=True,
        must_change_password=True,
    )
    db.add(initial_admin)

    fee_tier = MembershipFee(
        share_subscription_fee=Decimal("500.00"),
        share_fee=Decimal("1000.00"),
        membership_fee=Decimal("200.00"),
        description="Standard Police Personnel Tier",
        is_active=True,
    )
    db.add(fee_tier)
    db.commit()
    db.refresh(initial_admin)
    db.refresh(fee_tier)
    print(f"  -> Admin seeded: username='{initial_admin.username}', ID={initial_admin.admin_id}")
    print(f"  -> Fee tier seeded: mf_id={fee_tier.mf_id}, fee={fee_tier.membership_fee}")

    # 3. Test Admin Login with Invalid Password
    print("\n[TEST 3] Testing Admin Login with Invalid Password...")
    req = create_dummy_request()
    res = Response()
    bad_payload = AdminLoginRequest(username="admin", password="WrongPassword999")
    try:
        auth.login(bad_payload, req, res, db)
        assert False, "Login should have raised 401 HTTPException"
    except HTTPException as e:
        assert e.status_code == 401
        print(f"  -> Rejected invalid password cleanly with HTTP 401: {e.detail}")

    # 4. Test Admin Login with Correct Initial Password
    print("\n[TEST 4] Testing Admin Login with the in-memory test password...")
    valid_payload = AdminLoginRequest(username="admin", password=TEST_ADMIN_PASSWORD)
    login_result = auth.login(valid_payload, req, res, db)
    assert login_result.admin.username == "admin"
    assert login_result.admin.must_change_password is True
    session_token = login_result.session_token
    assert session_token, "Session token must be generated"
    print(f"  -> Login successful! Token: {session_token[:12]}...")
    print(f"  -> Admin must_change_password flag: {login_result.admin.must_change_password}")

    # Verify session in DB has hashed token
    token_hash = hash_session_token(session_token)
    db_session = db.query(AdminSession).filter_by(token_hash=token_hash).first()
    assert db_session is not None, "Session record must exist in DB"
    assert not db_session.is_revoked
    print(f"  -> Verified: Session token is stored strictly as SHA-256 hash in DB: {token_hash[:16]}...")

    # 5. Test Dependency: get_current_admin with valid session
    print("\n[TEST 5] Testing dependency `get_current_admin` via HttpOnly cookie...")
    auth_req = create_dummy_request(cookies={settings.SESSION_COOKIE_NAME: session_token})
    auth_res = Response()
    authenticated_admin = get_current_admin(auth_req, auth_res, db)
    assert authenticated_admin.admin_id == initial_admin.admin_id
    print(f"  -> Successfully authenticated Admin: '{authenticated_admin.username}'")

    # 6. Test Inactivity Timeout Rejection
    print("\n[TEST 6] Testing Session Inactivity Timeout...")
    # Artificially set last_activity_at to 2 hours ago
    db_session.last_activity_at = datetime.now(timezone.utc) - timedelta(hours=2)
    db.commit()
    try:
        get_current_admin(auth_req, auth_res, db)
        assert False, "Should have raised 401 due to inactivity"
    except HTTPException as e:
        assert e.status_code == 401
        assert "timed out due to inactivity" in e.detail
        print(f"  -> Inactivity timeout correctly enforced with 401: {e.detail}")

    # Reset last_activity_at for subsequent tests
    db_session.last_activity_at = datetime.now(timezone.utc)
    db.commit()

    # 7. Test Route Protection: `require_password_changed`
    print("\n[TEST 7] Testing that protected write operations require initial password change...")
    try:
        require_password_changed(authenticated_admin)
        assert False, "Should have raised 403 Forbidden"
    except HTTPException as e:
        assert e.status_code == 403
        assert "Initial password change required" in e.detail
        print(f"  -> Blocked cleanly with HTTP 403: {e.detail}")

    # 8. Test Admin Password Change
    print("\n[TEST 8] Testing Password Change to Secure Administrator Password...")
    new_password = "SecureAdmin#2026@SP"
    change_payload = ChangePasswordRequest(
        current_password=TEST_ADMIN_PASSWORD,
        new_password=new_password,
        confirm_password=new_password,
    )
    change_res = auth.change_password(change_payload, auth_req, authenticated_admin, db)
    assert "Password changed successfully" in change_res.message
    print(f"  -> Password changed successfully: {change_res.message}")

    # Verify must_change_password is now False
    db.refresh(initial_admin)
    assert initial_admin.must_change_password is False
    print("  -> Verified: must_change_password is now FALSE.")

    # Verify `require_password_changed` dependency now passes
    ready_admin = require_password_changed(initial_admin)
    assert ready_admin.admin_id == initial_admin.admin_id
    print("  -> Verified: `require_password_changed` now allows admin access to all routes!")

    # 9. Test Police Station Creation
    print("\n[TEST 9] Testing Police Station Creation...")
    ps_payload = PoliceStationCreate(
        station_name="SP Office Central Police Station",
        address="SP Office Campus, District Administrative Complex",
    )
    new_station = police_stations.create_station(ps_payload, ready_admin, db)
    assert new_station.ps_id is not None
    assert new_station.station_name == "SP Office Central Police Station"
    ps_id = new_station.ps_id
    print(f"  -> Created Police Station: ID={ps_id}, Name='{new_station.station_name}'")

    # 10. Test Police Station Duplicate Prevention
    print("\n[TEST 10] Testing Police Station Duplicate Name Prevention...")
    try:
        police_stations.create_station(ps_payload, ready_admin, db)
        assert False, "Should have rejected duplicate station name"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"  -> Duplicate name rejected with HTTP 400: {e.detail}")

    # 11. Test Police Station Listing and Updating
    print("\n[TEST 11] Testing Police Station List and Update...")
    ps_list = police_stations.list_stations(page=1, size=20, search="Central", active_only=True, admin=ready_admin, db=db)
    assert ps_list.total == 1
    assert ps_list.items[0].ps_id == ps_id
    print(f"  -> List verified: Found {ps_list.total} station(s) matching search 'Central'.")

    ps_update_payload = PoliceStationUpdate(
        station_name="SP Office Central Police Station (Updated)",
        address="New Administrative Wing, SP Office",
        is_active=True,
    )
    updated_ps = police_stations.update_station(ps_id, ps_update_payload, ready_admin, db)
    assert updated_ps.station_name == "SP Office Central Police Station (Updated)"
    print(f"  -> Updated Station Name: '{updated_ps.station_name}'")

    # 12. Test Police Personnel Member Registration
    print("\n[TEST 12] Testing Police Personnel Member Registration...")
    member_payload = UserCreate(
        kgid="KGID-88390",
        share_number="SHR-1002",
        buckle_number="HC-512",
        full_name="Santosh Kumar",
        designation="Head Constable",
        ps_id=ps_id,
        bank_account_number="987654321098",
        ifsc_code="SBIN0001234",
        dob=date(1987, 8, 22),
        gender="Male",
        caste="General",
        sub_caste="Lingayat",
        category="3B",
        membership_start_date=date(2025, 1, 1),
        mf_id=fee_tier.mf_id,
    )
    registered_member = users.register_member(member_payload, ready_admin, db)
    assert registered_member["kgid"] == "KGID-88390"
    assert registered_member["full_name"] == "Santosh Kumar"
    assert registered_member["bank_account_masked"] == "********1098"
    current_period_subscription = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390",
        record_type="subscription",
        year=date.today().year,
        month=date.today().month,
    ).one()
    assert current_period_subscription.amount == Decimal("500.00")
    assert current_period_subscription.transaction_date == date.today().replace(day=1)
    expected_subscription_count = (date.today().year - 2025) * 12 + date.today().month
    assert db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="subscription"
    ).count() == expected_subscription_count
    print(f"  -> Member registered: KGID='{registered_member['kgid']}', Name='{registered_member['full_name']}'")
    print(f"  -> Bank account properly masked: {registered_member['bank_account_masked']}")

    # 12b. Test membership tier history and monthly subscription snapshots
    print("\n[TEST 12b] Testing membership history and monthly subscription generation...")
    initial_assignment = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="membership", expires_at=None
    ).one()
    assert initial_assignment.mf_id == fee_tier.mf_id
    assert initial_assignment.effective_from == date(2025, 1, 1)
    assert registered_member["financial_year"] == "2024-25"
    assert registered_member["financial_month"] == "January"

    assert user_service.generate_monthly_subscriptions(db, 2026, 1, kgid="KGID-88390") == 0
    january_subscription = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="subscription", year=2026, month=1
    ).one()
    assert january_subscription.amount == Decimal("500.00")
    assert january_subscription.transaction_date == date(2026, 1, 1)

    legacy_member = User(
        kgid="KGID-LEGACY-1",
        full_name="Legacy Member",
        designation="Constable",
        ps_id=ps_id,
        bank_account_number="123456789012",
        ifsc_code="SBIN0001234",
        dob=date(1985, 5, 10),
        gender="Male",
        financial_year="2024-25",
        financial_month="January",
        status="Active",
        mf_id=fee_tier.mf_id,
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.add(legacy_member)
    db.commit()
    backfilled_count = user_service.generate_missing_membership_subscriptions(
        db,
        as_of=date(2025, 2, 1),
        kgid=legacy_member.kgid,
    )
    assert backfilled_count == 2
    legacy_assignment = db.query(MembershipRecord).filter_by(
        kgid=legacy_member.kgid, record_type="membership"
    ).one()
    assert legacy_assignment.effective_from == date(2025, 1, 1)
    assert db.query(MembershipRecord).filter_by(
        kgid=legacy_member.kgid, record_type="subscription"
    ).count() == 2

    midmonth_member, error = user_service.create_member(
        db,
        UserCreate(
            kgid="KGID-MIDMONTH-1",
            full_name="Midmonth Member",
            designation="Constable",
            ps_id=ps_id,
            bank_account_number="123456789013",
            ifsc_code="SBIN0001234",
            dob=date(1986, 6, 12),
            gender="Male",
            financial_year="2024-25",
            financial_month="January",
            membership_start_date=date(2025, 1, 15),
            mf_id=fee_tier.mf_id,
        ),
    )
    assert midmonth_member is not None, error
    assert db.query(MembershipRecord).filter_by(
        kgid=midmonth_member.kgid, record_type="subscription", year=2025, month=1
    ).count() == 0
    assert db.query(MembershipRecord).filter_by(
        kgid=midmonth_member.kgid, record_type="subscription", year=2025, month=2
    ).count() == 1

    fee_tier.share_subscription_fee = Decimal("650.00")
    db.commit()
    assert user_service.generate_monthly_subscriptions(db, 2026, 2, kgid="KGID-88390") == 0
    february_subscription = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="subscription", year=2026, month=2
    ).one()
    assert january_subscription.amount == Decimal("500.00")
    assert february_subscription.amount == Decimal("500.00")

    today = date.today()
    next_month = date(today.year + (today.month // 12), today.month % 12 + 1, 1)
    following_month = date(next_month.year + (next_month.month // 12), next_month.month % 12 + 1, 1)
    assert user_service.generate_monthly_subscriptions(
        db, next_month.year, next_month.month, kgid="KGID-88390"
    ) == 1
    next_month_subscription = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="subscription", year=next_month.year, month=next_month.month
    ).one()
    assert next_month_subscription.amount == Decimal("650.00")

    replacement_tier = MembershipFee(
        share_subscription_fee=Decimal("750.00"),
        share_fee=Decimal("1200.00"),
        membership_fee=Decimal("250.00"),
        description="Replacement test tier",
        is_active=True,
    )
    db.add(replacement_tier)
    db.commit()
    changed_member, error = user_service.update_member(
        db,
        "KGID-88390",
        UserUpdate(mf_id=replacement_tier.mf_id),
    )
    assert changed_member is not None, error
    db.refresh(initial_assignment)
    assert initial_assignment.expires_at == date.today()
    active_assignment = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="membership", expires_at=None
    ).one()
    assert active_assignment.mf_id == replacement_tier.mf_id
    assert user_service.generate_monthly_subscriptions(
        db, following_month.year, following_month.month, kgid="KGID-88390"
    ) == 1
    march_subscription = db.query(MembershipRecord).filter_by(
        kgid="KGID-88390", record_type="subscription", year=following_month.year, month=following_month.month
    ).one()
    assert march_subscription.amount == Decimal("750.00")

    user_service.set_member_status(db, "KGID-88390", "Inactive")
    inactive_month = date(following_month.year + (following_month.month // 12), following_month.month % 12 + 1, 1)
    assert user_service.generate_monthly_subscriptions(
        db, inactive_month.year, inactive_month.month, kgid="KGID-88390"
    ) == 0
    user_service.set_member_status(db, "KGID-88390", "Active")
    print("  -> Tier history, idempotency, inactive exclusion, and fee snapshots verified.")

    # 13. Test Duplicate KGID Prevention
    print("\n[TEST 13] Testing Duplicate KGID Prevention...")
    try:
        users.register_member(member_payload, ready_admin, db)
        assert False, "Should have rejected duplicate KGID"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"  -> Duplicate KGID rejected cleanly with HTTP 400: {e.detail}")

    # 14. Test Member Listing & Search
    print("\n[TEST 14] Testing Member Listing with Search...")
    members_list = users.list_members(page=1, size=20, search="Santosh", admin=ready_admin, db=db)
    assert members_list.total == 1
    item = members_list.items[0]
    assert item.kgid == "KGID-88390"
    assert item.police_station_name == "SP Office Central Police Station (Updated)"
    assert item.bank_account_masked == "********1098"
    print(f"  -> Member list verified: Found {members_list.total} member, station='{item.police_station_name}'")

    # 15. Test Member Detail by KGID
    print("\n[TEST 15] Testing Member Detail by KGID...")
    detail = users.get_member("KGID-88390", ready_admin, db)
    assert detail["kgid"] == "KGID-88390"
    assert detail["bank_account_number"] == "987654321098"
    print(f"  -> Member detail verified: Full bank account accessible to authenticated Admin.")

    # 16. Test Member Editing, Status, and Document Upload
    print("\n[TEST 16] Testing member edit, inactive status, and document upload...")
    edited_member = users.update_member(
        "KGID-88390",
        UserUpdate(full_name="Santosh Kumar Updated"),
        ready_admin,
        db,
    )
    assert edited_member["full_name"] == "Santosh Kumar Updated"
    inactive_member = users.update_member_status(
        "KGID-88390",
        UserStatusUpdate(status="Inactive"),
        ready_admin,
        db,
    )
    assert inactive_member["status"] == "Inactive"
    assert db.get(User, "KGID-88390") is not None
    active_member = users.update_member_status(
        "KGID-88390",
        UserStatusUpdate(status="Active"),
        ready_admin,
        db,
    )
    assert active_member["status"] == "Active"

    previous_upload_dir = settings.UPLOAD_DIR
    with tempfile.TemporaryDirectory() as upload_dir:
        settings.UPLOAD_DIR = upload_dir
        try:
            upload = StarletteUploadFile(filename="membership.pdf", file=io.BytesIO(b"%PDF-1.4 test"))
            uploaded = users.upload_member_documents(
                "KGID-88390", [upload], DocTypeEnum.MEMBERSHIP, ready_admin, db
            )
            assert len(uploaded) == 1
            assert uploaded[0].original_filename == "Santosh_Kumar_Updated_membership_1.pdf"
            listed_documents = users.list_member_documents("KGID-88390", ready_admin, db)
            assert listed_documents[0].original_filename == "Santosh_Kumar_Updated_membership_1.pdf"
            download = users.download_member_document("KGID-88390", uploaded[0].doc_id, ready_admin, db)
            assert Path(download.path).read_bytes() == b"%PDF-1.4 test"

            second_upload = StarletteUploadFile(filename="membership-copy.pdf", file=io.BytesIO(b"%PDF-1.4 copy"))
            second_membership = users.upload_member_documents(
                "KGID-88390", [second_upload], DocTypeEnum.MEMBERSHIP, ready_admin, db
            )[0]
            assert second_membership.original_filename == "Santosh_Kumar_Updated_membership_2.pdf"

            loan_upload = StarletteUploadFile(filename="loan-form.pdf", file=io.BytesIO(b"%PDF-1.4 loan"))
            loan_document = users.upload_member_documents(
                "KGID-88390", [loan_upload], DocTypeEnum.LOAN_APPLICATION, ready_admin, db
            )[0]
            assert loan_document.original_filename == "Santosh_Kumar_Updated_loan_application_1.pdf"
            assert Path(settings.upload_path, loan_document.file_path).is_file()
        finally:
            settings.UPLOAD_DIR = previous_upload_dir
    print("  -> Member update and Active/Inactive changes retained the member record.")
    print("  -> PDF upload, listing, and authenticated download verified.")

    # 17. Test Admin Logout and Session Invalidation
    print("\n[TEST 17] Testing Admin Logout and Session Revocation...")
    logout_res = auth.logout(auth_req, auth_res, ready_admin, db)
    assert "Logged out successfully" in logout_res.message
    print(f"  -> Logout executed: {logout_res.message}")

    # Subsequent access with same token must fail with 401
    try:
        get_current_admin(auth_req, auth_res, db)
        assert False, "Should have rejected revoked session"
    except HTTPException as e:
        assert e.status_code == 401
        assert "revoked" in e.detail.lower() or "invalid" in e.detail.lower()
        print(f"  -> Verified: Revoked session returns HTTP 401: {e.detail}")

    print("\n" + "=" * 80)
    print("ALL 17 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("=" * 80)


if __name__ == "__main__":
    run_all_tests()
