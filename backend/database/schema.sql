-- ==============================================================================
-- SP Office Membership and Fund Management System - PostgreSQL Schema
-- ==============================================================================
-- Target Database: PostgreSQL 14+ (e.g. PostgreSQL 18 / financeDB)
-- Driver: Psycopg 3 / SQLAlchemy 2.0
-- Description: Core schema definitions including admin authentication,
--              police stations, configurable membership fees, personnel members,
--              documents, loans, and loan payments with safe deletion rules.
-- ==============================================================================

-- Drop existing tables and types in reverse dependency order if recreating:
-- DROP TABLE IF EXISTS loan_payments CASCADE;
-- DROP TABLE IF EXISTS loans CASCADE;
-- DROP TABLE IF EXISTS documents CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS membership_fees CASCADE;
-- DROP TABLE IF EXISTS police_stations CASCADE;
-- DROP TABLE IF EXISTS admin_sessions CASCADE;
-- DROP TABLE IF EXISTS admin CASCADE;
-- DROP TYPE IF EXISTS doc_type_enum CASCADE;
-- DROP TYPE IF EXISTS loan_type_enum CASCADE;

-- ------------------------------------------------------------------------------
-- 1. Custom ENUM Types
-- ------------------------------------------------------------------------------

-- Document Types (2 options as required: Membership, Loan Application)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type_enum') THEN
        CREATE TYPE doc_type_enum AS ENUM (
            'Membership', 
            'Loan Application'
        );
    END IF;
END $$;

-- Loan Schemes / Types (Official 5 options as per SP Office Scheme)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_type_enum') THEN
        CREATE TYPE loan_type_enum AS ENUM (
            'Society Personal Advance', 
            'Housing Assistance Advance', 
            'Emergency Medical Advance', 
            'Festival Advance', 
            'Education Assistance Advance'
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Automatic updated_at Trigger Function
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Admin Table
-- ------------------------------------------------------------------------------
-- Only one system administrator is supported. Initial seeding handled via script.
CREATE TABLE IF NOT EXISTS admin (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_admin_updated_at
BEFORE UPDATE ON admin
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. Admin Sessions Table
-- ------------------------------------------------------------------------------
-- Stores secure database-backed session tokens (SHA-256 hashed) with expiry and inactivity tracking.
CREATE TABLE IF NOT EXISTS admin_sessions (
    session_id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admin(admin_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_revoked ON admin_sessions(is_revoked);

-- ------------------------------------------------------------------------------
-- 5. Police Stations Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS police_stations (
    ps_id SERIAL PRIMARY KEY,
    station_name VARCHAR(150) NOT NULL UNIQUE,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_police_stations_name ON police_stations(station_name);
CREATE INDEX IF NOT EXISTS idx_police_stations_active ON police_stations(is_active);

CREATE TRIGGER trg_police_stations_updated_at
BEFORE UPDATE ON police_stations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. Membership Fees Configuration Table
-- ------------------------------------------------------------------------------
-- Configurable fee tiers referenced by members
CREATE TABLE IF NOT EXISTS membership_fees (
    mf_id SERIAL PRIMARY KEY,
    share_subscription_fee NUMERIC(12, 2) NOT NULL CHECK (share_subscription_fee >= 0),
    share_fee NUMERIC(12, 2) NOT NULL CHECK (share_fee >= 0),
    membership_fee NUMERIC(12, 2) NOT NULL CHECK (membership_fee >= 0),
    description VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_membership_fees_updated_at
BEFORE UPDATE ON membership_fees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. Users Table (Police Personnel Membership)
-- ------------------------------------------------------------------------------
-- Primary identifier is KGID (VARCHAR to support alphanumeric or leading zeros)
CREATE TABLE IF NOT EXISTS users (
    kgid VARCHAR(50) PRIMARY KEY,
    share_number VARCHAR(50) UNIQUE,
    buckle_number VARCHAR(50),
    full_name VARCHAR(150) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    ps_id INTEGER NOT NULL REFERENCES police_stations(ps_id) ON DELETE RESTRICT,
    bank_account_number VARCHAR(50) NOT NULL,
    ifsc_code VARCHAR(20) NOT NULL,
    dob DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    caste VARCHAR(50),
    sub_caste VARCHAR(50),
    category VARCHAR(50),
    financial_year VARCHAR(20) NOT NULL,
    financial_month VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    mf_id INTEGER NOT NULL REFERENCES membership_fees(mf_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_ps_id ON users(ps_id);
CREATE INDEX IF NOT EXISTS idx_users_mf_id ON users(mf_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_share_number ON users(share_number);
CREATE INDEX IF NOT EXISTS idx_users_buckle_number ON users(buckle_number);
CREATE INDEX IF NOT EXISTS idx_users_name_station ON users(full_name, ps_id);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. Documents Table
-- ------------------------------------------------------------------------------
-- Uses doc_type_enum ('Membership', 'Loan Application')
CREATE TABLE IF NOT EXISTS documents (
    doc_id SERIAL PRIMARY KEY,
    doc_type doc_type_enum NOT NULL,
    kgid VARCHAR(50) NOT NULL REFERENCES users(kgid) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255),
    file_size_bytes BIGINT,
    stored_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_kgid ON documents(kgid);
CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

-- ------------------------------------------------------------------------------
-- 9. Loans Table
-- ------------------------------------------------------------------------------
-- Uses loan_type_enum for the 5 official loan schemes
CREATE TABLE IF NOT EXISTS loans (
    loan_id SERIAL PRIMARY KEY,
    kgid VARCHAR(50) NOT NULL REFERENCES users(kgid) ON DELETE RESTRICT,
    ps_id INTEGER NOT NULL REFERENCES police_stations(ps_id) ON DELETE RESTRICT,
    loan_type loan_type_enum NOT NULL,
    sanction_date DATE NOT NULL,
    sanction_amount NUMERIC(12, 2) NOT NULL CHECK (sanction_amount > 0),
    monthly_principal NUMERIC(12, 2) NOT NULL CHECK (monthly_principal >= 0),
    monthly_interest NUMERIC(12, 2) NOT NULL CHECK (monthly_interest >= 0),
    start_month VARCHAR(20) NOT NULL,
    end_date DATE NOT NULL,
    total_installments INTEGER NOT NULL CHECK (total_installments > 0),
    document_attachment VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'Sanctioned',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loans_kgid ON loans(kgid);
CREATE INDEX IF NOT EXISTS idx_loans_ps_id ON loans(ps_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_sanction_date ON loans(sanction_date);

CREATE TRIGGER trg_loans_updated_at
BEFORE UPDATE ON loans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 10. Loan Payments Table
-- ------------------------------------------------------------------------------
-- Installment recovery and balance tracking. Protected from accidental deletion.
CREATE TABLE IF NOT EXISTS loan_payments (
    pay_id SERIAL PRIMARY KEY,
    kgid VARCHAR(50) NOT NULL REFERENCES users(kgid) ON DELETE RESTRICT,
    loan_id INTEGER NOT NULL REFERENCES loans(loan_id) ON DELETE RESTRICT,
    recovered_amount NUMERIC(12, 2) NOT NULL CHECK (recovered_amount >= 0),
    balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0),
    total_interest NUMERIC(12, 2) NOT NULL CHECK (total_interest >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'Paid',
    payment_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_kgid ON loan_payments(kgid);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_date ON loan_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_status ON loan_payments(status);

CREATE TRIGGER trg_loan_payments_updated_at
BEFORE UPDATE ON loan_payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
