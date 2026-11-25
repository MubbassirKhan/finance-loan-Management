# SP Office Membership and Fund Management System – Backend

Official Backend Foundation for the **Superintendent of Police (SP) Office Membership and Fund Management System**.

Built with **Python FastAPI**, **SQLAlchemy 2.0**, **PostgreSQL** (with **Psycopg 3** driver), and **Pydantic v2**, following clean architecture, strict security guidelines, database-backed session management, and modular separation of concerns.

---

## 1. Tech Stack & Architecture

- **Web Framework**: [FastAPI](https://fastapi.tiangolo.com/) (High performance, async ASGI, automatic Swagger/OpenAPI docs)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (Production-ready relational DB with custom types, check constraints, indexes, and triggers)
- **ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (Modern declarative typing with `Mapped`, `mapped_column`, relational cascades, and safe parameterization)
- **Database Driver**: [Psycopg 3](https://www.psycopg.org/psycopg3/) (`psycopg[binary]>=3.2.0` with resilient fallback to `psycopg2` if needed)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & `pydantic-settings`
- **Security & Authentication**:
  - Secure database-backed Admin session management (`admin_sessions`)
  - Cryptographically secure 256-bit entropy session tokens (`secrets.token_urlsafe(32)`)
  - SHA-256 token hashing for database storage (no raw tokens stored)
  - `HttpOnly`, `SameSite=lax`, and `Secure` cookie protection
  - Absolute session expiration (24h) and inactivity idle timeout (60m)
  - Password hashing with **bcrypt** (salt rounds = 12)
  - Mandatory initial password change enforcement
  - In-memory rate limiting / lockout against brute-force attacks
  - Sensitive data protection (bank account masking: `********1234`)

---

## 2. Project Directory Structure

```text
SP Office/Official site/
│
├── backend/
│   └── app/
│       ├── main.py                     # FastAPI application setup, CORS, lifespan, exception handlers
│       │
│       ├── core/
│       │   ├── config.py               # Pydantic BaseSettings loading from .env
│       │   ├── security.py             # Bcrypt password hashing & SHA-256 session token generation
│       │   └── session.py              # Session lifecycle, expiry, and idle timeout validation
│       │
│       ├── database/
│       │   ├── base.py                 # SQLAlchemy 2.0 DeclarativeBase and TimestampMixin
│       │   ├── connection.py           # Engine pool, SessionLocal, and get_db dependency
│       │   └── init_db.py              # Script/utility to create all tables programmatically
│       │
│       ├── models/                     # SQLAlchemy ORM database models
│       │   ├── __init__.py             # Exports all models
│       │   ├── admin.py                # Admin model (single system administrator)
│       │   ├── admin_session.py        # Database-backed session records with token hashes
│       │   ├── police_station.py       # Police stations and units
│       │   ├── membership_fee.py       # Configurable fee tiers (subscription, share, fee)
│       │   ├── user.py                 # Police personnel members (KGID primary key)
│       │   ├── document.py             # Member & loan document storage metadata
│       │   ├── loan.py                 # Loan sanctions, installments, and terms
│       │   └── loan_payment.py         # Recoveries, balances, and interest records
│       │
│       ├── schemas/                    # Pydantic request and response schemas
│       │   ├── __init__.py
│       │   ├── auth.py                 # Login, profile, password change payloads & responses
│       │   ├── police_station.py       # Police station CRUD schemas
│       │   ├── membership_fee.py       # Fee tier schemas
│       │   └── user.py                 # Member registration, updates, and masked responses
│       │
│       ├── services/                   # Business logic layer
│       │   ├── __init__.py
│       │   ├── auth_service.py         # Admin authentication, rate limiting, session revocation
│       │   ├── police_station_service.py # Police station business operations
│       │   └── user_service.py           # Member registration, uniqueness checks, masked listing
│       │
│       ├── dependencies/               # Reusable FastAPI route dependencies
│       │   ├── __init__.py
│       │   └── auth.py                 # get_current_admin and require_password_changed
│       │
│       └── routes/                     # API routers mounted under /api/v1
│           ├── __init__.py
│           ├── auth.py                 # /api/v1/auth (login, logout, me, change-password)
│           ├── police_stations.py      # /api/v1/police-stations (CRUD, deactivation)
│           └── users.py                # /api/v1/users (member registration, list, details)
│
├── database/
│   └── schema.sql                      # Production PostgreSQL DDL (tables, ENUMs, indexes, triggers)
│
├── scripts/
│   ├── seed_admin.py                   # Secure initial admin & fee tier seeder script
│   └── test_backend.py                 # Comprehensive 16-point automated test suite
│
├── uploads/                            # Secure folder for uploaded documents (.gitkeep)
├── .env                                # Local environment variables (do not commit to Git)
├── .env.example                        # Template for environment configuration
├── .gitignore                          # Git exclusions (ignores .env, uploads, pycache, venv)
├── requirements.txt                    # Python dependencies
└── README.md                           # Documentation
```

---

## 3. Database Tables & Relationships

The relational design enforces strict referential integrity and safe financial deletion rules (`ON DELETE RESTRICT`):

```mermaid
erDiagram
    ADMIN ||--o{ ADMIN_SESSIONS : "has active sessions"
    POLICE_STATIONS ||--o{ USERS : "employs personnel"
    POLICE_STATIONS ||--o{ LOANS : "originates loan"
    MEMBERSHIP_FEES ||--o{ USERS : "assigned fee tier"
    USERS ||--o{ DOCUMENTS : "uploads documents"
    USERS ||--o{ LOANS : "receives loans"
    USERS ||--o{ LOAN_PAYMENTS : "makes payments"
    LOANS ||--o{ LOAN_PAYMENTS : "tracks repayments"

    ADMIN {
        int admin_id PK
        string username UK
        string password_hash
        boolean is_active
        boolean must_change_password
        timestamptz created_at
        timestamptz updated_at
    }

    ADMIN_SESSIONS {
        int session_id PK
        int admin_id FK
        string token_hash UK
        timestamptz expires_at
        timestamptz last_activity_at
        boolean is_revoked
        string ip_address
        string user_agent
        timestamptz created_at
    }

    POLICE_STATIONS {
        int ps_id PK
        string station_name UK
        text address
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    MEMBERSHIP_FEES {
        int mf_id PK
        numeric share_subscription_fee
        numeric share_fee
        numeric membership_fee
        string description
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    USERS {
        string kgid PK
        string share_number UK
        string buckle_number
        string full_name
        string designation
        int ps_id FK
        string bank_account_number
        string ifsc_code
        date dob
        string gender
        string caste
        string sub_caste
        string category
        string financial_year
        string financial_month
        string status
        int mf_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    DOCUMENTS {
        int doc_id PK
        string doc_type
        string kgid FK
        string file_path
        string original_filename
        bigint file_size_bytes
        date stored_date
        timestamptz created_at
    }

    LOANS {
        int loan_id PK
        string kgid FK
        int ps_id FK
        string loan_type
        date sanction_date
        numeric sanction_amount
        numeric monthly_principal
        numeric monthly_interest
        string start_month
        date end_date
        int total_installments
        string document_attachment
        string status
        timestamptz created_at
        timestamptz updated_at
    }

    LOAN_PAYMENTS {
        int pay_id PK
        string kgid FK
        int loan_id FK
        numeric recovered_amount
        numeric balance
        numeric total_interest
        string status
        date payment_date
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 4. Installation and Setup Guide

### Step 1: Clone & Navigate to Project Directory

```powershell
cd "c:\Users\MUBBASSIRKHAN\Desktop\SP Office\Official site"
```

### Step 2: Create and Activate Virtual Environment (Recommended)

```powershell
# Create virtual environment
python -m venv venv

# Activate on Windows PowerShell
.\venv\Scripts\Activate.ps1

# (Or on Linux/macOS: source venv/bin/activate)
```

### Step 3: Install Required Dependencies

```powershell
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables

The project includes `.env.example`. Ensure your `.env` file is present in the project root:

```ini
ENVIRONMENT=development
PROJECT_NAME="SP Office Membership and Fund Management System"
API_V1_PREFIX=/api/v1

SECRET_KEY=dev-secret-key-sp-office-membership-fund-mgmt-system-2026-xyz

# PostgreSQL Database Connection (Psycopg 3)
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/sp_office_db

# Session Management Settings
SESSION_COOKIE_NAME=sp_admin_session
SESSION_EXPIRE_HOURS=24
SESSION_INACTIVITY_MINUTES=60
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
COOKIE_HTTPONLY=true

# Initial Admin Credentials (used exclusively for seeding)
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin@123

# File Upload Restrictions
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=10
ALLOWED_EXTENSIONS=pdf,jpg,jpeg,png

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
```

---

## 5. Database Setup & Seeding

### Option A: Using PostgreSQL psql CLI

1. Create the PostgreSQL database:
   ```sql
   CREATE DATABASE sp_office_db;
   ```
2. Execute the provided SQL schema script:
   ```powershell
   psql -U postgres -d sp_office_db -f database/schema.sql
   ```

### Option B: Automatic Programmatic Table Creation

The application can create all tables automatically via SQLAlchemy:

```powershell
$env:PYTHONPATH = "backend"
python backend/app/database/init_db.py
```

### Step 5: Seed the Initial Administrator & Default Fee Tier

Run the seed script:

```powershell
python scripts/seed_admin.py
```

Console Output:
```text
======================================================================
SP Office Membership & Fund Management System - Database Seeder
======================================================================
[1/3] Ensuring database schema exists...
      Database tables verified/created successfully.
[2/3] Checking Administrator account...
      Creating initial administrator 'admin'...
      [OK] Initial administrator created successfully!
           Username: admin
           Initial Password: admin@123
           Note: The admin will be prompted to change their password upon first login.
[3/3] Checking default Membership Fee tiers...
      [OK] Default fee tier created (mf_id: 1).
======================================================================
Database seeding completed successfully.
======================================================================
```

*(If you ever need to reset the admin password back to initial defaults, run `python scripts/seed_admin.py --reset-password`).*

---

## 6. Running the FastAPI Application

Start the development server with Uvicorn:

```powershell
$env:PYTHONPATH = "backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Once running:
- **Interactive Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 7. Running the Automated Verification Test Suite

A self-contained test suite is included that exercises all 16 critical paths (database creation, admin login, password enforcement, station CRUD, member registration, masking, and logout):

```powershell
python scripts/test_backend.py
```

Output:
```text
================================================================================
STARTING SP OFFICE BACKEND FOUNDATION & AUTHENTICATION VERIFICATION SUITE
================================================================================
[TEST 1] Creating database schema in SQLite test engine...
  -> Schema initialized successfully.
[TEST 2] Seeding initial Administrator (admin / admin@123) and default fee tier...
  -> Admin seeded: username='admin', ID=1
  -> Fee tier seeded: mf_id=1, fee=200.00
[TEST 3] Testing Admin Login with Invalid Password...
  -> Rejected invalid password cleanly with HTTP 401: Invalid username or password.
[TEST 4] Testing Admin Login with Initial Password (admin@123)...
  -> Login successful! Token: ...
  -> Admin must_change_password flag: True
  -> Verified: Session token is stored strictly as SHA-256 hash in DB
[TEST 5] Testing dependency `get_current_admin` via HttpOnly cookie...
  -> Successfully authenticated Admin: 'admin'
[TEST 6] Testing Session Inactivity Timeout...
  -> Inactivity timeout correctly enforced with 401
[TEST 7] Testing that protected write operations require initial password change...
  -> Blocked cleanly with HTTP 403: Initial password change required.
[TEST 8] Testing Password Change to Secure Administrator Password...
  -> Password changed successfully.
  -> Verified: must_change_password is now FALSE.
  -> Verified: `require_password_changed` now allows admin access to all routes!
[TEST 9] Testing Police Station Creation...
  -> Created Police Station: ID=1, Name='SP Office Central Police Station'
[TEST 10] Testing Police Station Duplicate Name Prevention...
  -> Duplicate name rejected with HTTP 400
[TEST 11] Testing Police Station List and Update...
  -> List verified: Found 1 station(s)
  -> Updated Station Name: 'SP Office Central Police Station (Updated)'
[TEST 12] Testing Police Personnel Member Registration...
  -> Member registered: KGID='KGID-88390', Name='Santosh Kumar'
  -> Bank account properly masked: ********1098
[TEST 13] Testing Duplicate KGID Prevention...
  -> Duplicate KGID rejected cleanly with HTTP 400
[TEST 14] Testing Member Listing with Search...
  -> Member list verified: Found 1 member
[TEST 15] Testing Member Detail by KGID...
  -> Member detail verified: Full bank account accessible to authenticated Admin.
[TEST 16] Testing Admin Logout and Session Revocation...
  -> Logout executed: Logged out successfully.
  -> Verified: Revoked session returns HTTP 401: Session not found.
================================================================================
ALL 16 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!
================================================================================
```

---

## 8. Admin Authentication & Session Workflow

1. **Initial Login**:
   - Admin sends POST request to `/api/v1/auth/login` with username `admin` and password `admin@123`.
   - The backend checks bcrypt password hash and generates a 256-bit cryptographically random token (`secrets.token_urlsafe(32)`).
   - Only the SHA-256 hash of this token is saved in `admin_sessions`.
   - An `HttpOnly`, `SameSite=lax` cookie named `sp_admin_session` is set on the response (the raw token is also provided in the response body for Swagger / API clients).
   - The response includes `"must_change_password": true`.

2. **First-Login Password Change Enforcement**:
   - The dependency `require_password_changed` protects all write operations (e.g. creating police stations, registering members).
   - If `admin.must_change_password == True`, the API returns `403 Forbidden` with the message:
     *"Initial password change required. For security reasons, you must change your initial password at /api/v1/auth/change-password before performing administrative actions."*
   - Admin calls `POST /api/v1/auth/change-password` with:
     ```json
     {
       "current_password": "admin@123",
       "new_password": "MyStrongAdminPassword@2026",
       "confirm_password": "MyStrongAdminPassword@2026"
     }
     ```
   - The backend validates complexity (min 8 characters, letters, numbers, special characters), hashes the new password with bcrypt, sets `must_change_password = False`, and revokes any other active sessions.

3. **Inactivity Timeout & Expiry**:
   - Every request authenticated via `get_current_admin` touches `last_activity_at = CURRENT_TIMESTAMP`.
   - If the gap between requests exceeds `SESSION_INACTIVITY_MINUTES` (default 60 minutes), the session is rejected with `401 Unauthorized` and the stale cookie is deleted.
   - If the session age exceeds `SESSION_EXPIRE_HOURS` (default 24 hours), it expires automatically.

4. **Logout**:
   - Admin calls `POST /api/v1/auth/logout`.
   - The session record in `admin_sessions` has its `is_revoked` flag set to `True`.
   - The `sp_admin_session` cookie is deleted from the browser.

---

## 9. API Endpoints Reference

### Admin Authentication (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate admin, create session, set HttpOnly cookie | No |
| `POST` | `/api/v1/auth/logout` | Revoke session in database, clear cookie | Yes (`get_current_admin`) |
| `GET` | `/api/v1/auth/me` | Fetch currently logged-in admin profile | Yes (`get_current_admin`) |
| `POST` | `/api/v1/auth/change-password` | Update admin password, clear must_change_password flag | Yes (`get_current_admin`) |

#### Admin Login Request Body:
```json
{
  "username": "admin",
  "password": "admin@123"
}
```

#### Admin Login Response:
```json
{
  "message": "Login successful. NOTICE: You must change your default password.",
  "admin": {
    "admin_id": 1,
    "username": "admin",
    "is_active": true,
    "must_change_password": true,
    "created_at": "2026-11-24T06:10:00Z"
  },
  "session_token": "jHATKj1wDjC0..."
}
```

---

### Police Stations (`/api/v1/police-stations`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/police-stations` | Create a new police station or unit | Yes (`require_password_changed`) |
| `GET` | `/api/v1/police-stations` | List stations with pagination & search (`?search=&page=&size=`) | Yes (`get_current_admin`) |
| `GET` | `/api/v1/police-stations/{ps_id}` | Retrieve station details by ID | Yes (`get_current_admin`) |
| `PUT` | `/api/v1/police-stations/{ps_id}` | Update station name or address | Yes (`require_password_changed`) |
| `PATCH`| `/api/v1/police-stations/{ps_id}/deactivate` | Toggle active/deactive status | Yes (`require_password_changed`) |

#### Create Police Station Request:
```json
{
  "station_name": "SP Office Central Police Station",
  "address": "SP Office Campus, District Administrative Complex"
}
```

---

### Members & Personnel (`/api/v1/users`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/users` | Register police personnel member | Yes (`require_password_changed`) |
| `GET` | `/api/v1/users` | List members with search & masked bank accounts | Yes (`get_current_admin`) |
| `GET` | `/api/v1/users/{kgid}` | Get full member detail by KGID | Yes (`get_current_admin`) |
| `GET` | `/api/v1/users/membership-fees` | List available fee tiers | Yes (`get_current_admin`) |
| `POST` | `/api/v1/users/membership-fees` | Create new fee tier | Yes (`require_password_changed`) |

#### Register Member Request:
```json
{
  "kgid": "KGID-88390",
  "share_number": "SHR-1002",
  "buckle_number": "HC-512",
  "full_name": "Santosh Kumar",
  "designation": "Head Constable",
  "ps_id": 1,
  "bank_account_number": "987654321098",
  "ifsc_code": "SBIN0001234",
  "dob": "1987-08-22",
  "gender": "Male",
  "caste": "General",
  "sub_caste": "Lingayat",
  "category": "3B",
  "financial_year": "2025-2026",
  "financial_month": "April",
  "mf_id": 1
}
```

#### Member Response (Sensitive Bank Account Masked):
```json
{
  "kgid": "KGID-88390",
  "share_number": "SHR-1002",
  "buckle_number": "HC-512",
  "full_name": "Santosh Kumar",
  "designation": "Head Constable",
  "ps_id": 1,
  "police_station_name": "SP Office Central Police Station",
  "bank_account_masked": "********1098",
  "ifsc_code": "SBIN0001234",
  "dob": "1987-08-22",
  "gender": "Male",
  "caste": "General",
  "sub_caste": "Lingayat",
  "category": "3B",
  "financial_year": "2025-2026",
  "financial_month": "April",
  "status": "Active",
  "mf_id": 1,
  "created_at": "2026-11-24T06:10:00Z",
  "updated_at": "2026-11-24T06:10:00Z"
}
```

---

## 10. Security Compliance Summary

- **Never Plaintext**: Passwords hashed with standard salted bcrypt.
- **Token Security**: Tokens generated with 256-bit system entropy (`secrets.token_urlsafe(32)`). Stored only as SHA-256 hashes in PostgreSQL.
- **Session Controls**: Enforces cookie `HttpOnly`, `SameSite=lax`, 24h absolute expiration, and 60-minute inactivity timeouts.
- **Access Gating**: Unauthenticated access to protected routes returns `401 Unauthorized`. Initial admin access to write operations returns `403 Forbidden` until password change is fulfilled.
- **No Public Registration**: Admin account can only be provisioned via the seed script.
- **Financial Protection**: Foreign keys to financial and user records (`loans`, `loan_payments`, `users`) utilize `ON DELETE RESTRICT` to prevent accidental cascading deletion of critical audit trails.
- **Sensitive Data Privacy**: Bank account numbers are masked in lists (`********1098`) and only exposed in explicit single-member administrative views.
