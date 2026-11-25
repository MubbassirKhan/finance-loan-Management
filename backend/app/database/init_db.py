"""Database initialization script to create tables."""
import logging
from sqlalchemy import text
from app.database.connection import engine
from app.database.base import Base
# Import all models to register with Base.metadata
import app.models  # noqa: F401

logger = logging.getLogger("uvicorn.error")


def init_db() -> None:
    """Creates all database tables defined in the SQLAlchemy models."""
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    # Add new cutoff-interest columns to existing installations.
    with engine.begin() as connection:
        connection.execute(text("""
            ALTER TABLE loans
            ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(6, 4) NOT NULL DEFAULT 0
        """))
        connection.execute(text("""
            UPDATE loans
            SET interest_rate = CASE
                WHEN sanction_amount > 0 THEN
                    ROUND((monthly_interest * 1200.0 / sanction_amount)::numeric, 4)
                ELSE 0
            END
            WHERE interest_rate IS NULL OR interest_rate = 0
        """))

        # Recalculate incorrect legacy payment splits: recovery is fixed monthly principal,
        # cutoff interest is opening balance x annual rate / 12 / 100, and balance is sequential.
        connection.execute(text("""
            ALTER TABLE loan_payments
            ADD COLUMN IF NOT EXISTS installment_number INTEGER,
            ADD COLUMN IF NOT EXISTS opening_advance NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS payable_amount NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS proof_attachment VARCHAR(500),
            ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE
        """))
        connection.execute(text("ALTER TABLE loan_payments ALTER COLUMN payment_date DROP NOT NULL"))

        connection.execute(text("""
            DO $$
            DECLARE
                loan_row RECORD;
                payment_row RECORD;
                opening_balance NUMERIC(12, 2);
                cutoff_interest NUMERIC(12, 2);
                recovery_amount NUMERIC(12, 2);
                annual_rate NUMERIC(12, 6);
            BEGIN
                FOR loan_row IN SELECT * FROM loans LOOP
                    opening_balance := loan_row.sanction_amount;
                    annual_rate := loan_row.interest_rate;

                    FOR payment_row IN
                        SELECT * FROM loan_payments
                        WHERE loan_id = loan_row.loan_id
                        ORDER BY payment_date ASC, pay_id ASC
                    LOOP
                        cutoff_interest := ROUND((opening_balance * annual_rate / 1200.0)::numeric, 2);
                        recovery_amount := LEAST(loan_row.monthly_principal, opening_balance);
                        opening_balance := GREATEST(opening_balance - recovery_amount, 0);

                        UPDATE loan_payments
                        SET recovered_amount = recovery_amount,
                            total_interest = cutoff_interest,
                            balance = opening_balance,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE pay_id = payment_row.pay_id;
                    END LOOP;

                END LOOP;

                FOR loan_row IN SELECT * FROM loans LOOP
                    opening_balance := loan_row.sanction_amount;
                    annual_rate := loan_row.interest_rate;

                    CREATE TEMP TABLE IF NOT EXISTS temp_paid_rows (
                        seq INTEGER,
                        payment_date DATE,
                        paid_amount NUMERIC(12, 2)
                    ) ON COMMIT DROP;
                    DELETE FROM temp_paid_rows;

                    INSERT INTO temp_paid_rows (seq, payment_date, paid_amount)
                    SELECT ROW_NUMBER() OVER (ORDER BY payment_date ASC, pay_id ASC),
                           payment_date,
                           payable_amount
                    FROM loan_payments
                    WHERE loan_id = loan_row.loan_id;

                    DELETE FROM loan_payments WHERE loan_id = loan_row.loan_id;

                    FOR schedule_number IN 1..loan_row.total_installments LOOP
                        cutoff_interest := ROUND((opening_balance * annual_rate / 1200.0)::numeric, 2);
                        recovery_amount := LEAST(loan_row.monthly_principal, opening_balance);

                        SELECT t.payment_date, t.paid_amount
                        INTO payment_row
                        FROM temp_paid_rows t
                        WHERE t.seq = schedule_number;

                        IF FOUND THEN
                            INSERT INTO loan_payments (
                                kgid, loan_id, installment_number, opening_advance,
                                recovered_amount, balance, total_interest,
                                payable_amount, paid_amount, is_paid,
                                status, payment_date
                            ) VALUES (
                                loan_row.kgid, loan_row.loan_id, schedule_number,
                                opening_balance, recovery_amount,
                                GREATEST(opening_balance - recovery_amount, 0),
                                cutoff_interest,
                                recovery_amount + cutoff_interest,
                                payment_row.paid_amount,
                                TRUE, 'Paid', payment_row.payment_date
                            );
                        ELSE
                            INSERT INTO loan_payments (
                                kgid, loan_id, installment_number, opening_advance,
                                recovered_amount, balance, total_interest,
                                payable_amount, paid_amount, is_paid,
                                status, payment_date
                            ) VALUES (
                                loan_row.kgid, loan_row.loan_id, schedule_number,
                                opening_balance, recovery_amount,
                                GREATEST(opening_balance - recovery_amount, 0),
                                cutoff_interest,
                                recovery_amount + cutoff_interest,
                                0, FALSE, 'Projected', NULL
                            );
                        END IF;

                        opening_balance := GREATEST(opening_balance - recovery_amount, 0);
                    END LOOP;
                END LOOP;
            END $$
        """))

    logger.info("Database tables initialized successfully.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
