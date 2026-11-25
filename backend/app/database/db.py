"""Centralized Database Connection and Utility Module.

Provides standard database access functions for use everywhere in the application:
- get_db(): Use as a FastAPI Dependency (db: Session = Depends(get_db)) or Context Manager (with get_db() as db:)
- get_db_session(): Reusable context manager for background tasks, scripts, and services
- get_raw_connection(): Raw DBAPI connection for direct SQL execution
- execute_query(): Execute SELECT query and receive list of dictionary records
- execute_statement(): Execute INSERT/UPDATE/DELETE query
- check_connection(): Test connectivity to PostgreSQL / financeDB
"""
import logging
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Tuple
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

# Resolve database URL
resolved_url = settings.db_url

# Automatic driver fallback: If Psycopg 3 is specified but psycopg2 is installed
if resolved_url.startswith("postgresql+psycopg://"):
    try:
        import psycopg  # noqa: F401
    except ImportError:
        try:
            import psycopg2  # noqa: F401
            resolved_url = resolved_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
        except ImportError:
            pass

# Engine pooling configuration
engine_kwargs: Dict[str, Any] = {
    "pool_pre_ping": True,
}

if resolved_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

# Central SQLAlchemy Engine
engine = create_engine(resolved_url, **engine_kwargs)

# Central Session Factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Context manager for obtaining a database session in background jobs or standalone scripts.

    Usage:
        with get_db_session() as db:
            members = db.query(User).all()
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for injecting transactional database sessions into route handlers.

    Usage in Routes:
        @router.get('/items')
        def read_items(db: Session = Depends(get_db)):
            ...

    Also functions as a context manager:
        with get_db() as db:
            ...
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_raw_connection():
    """Provides a raw connection from the engine pool for raw SQL execution."""
    return engine.raw_connection()


def execute_query(query_sql: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Executes a SQL query and returns the results as a list of dictionaries.

    Usage:
        rows = execute_query("SELECT * FROM police_stations WHERE is_active = :active", {"active": True})
    """
    with SessionLocal() as session:
        result = session.execute(text(query_sql), params or {})
        columns = result.keys()
        return [dict(zip(columns, row)) for row in result.fetchall()]


def execute_statement(statement_sql: str, params: Dict[str, Any] = None) -> int:
    """Executes an INSERT, UPDATE, or DELETE SQL statement and returns affected row count."""
    with SessionLocal() as session:
        result = session.execute(text(statement_sql), params or {})
        session.commit()
        return result.rowcount


def check_connection() -> Tuple[bool, str]:
    """Tests connection to PostgreSQL financeDB and returns status."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, f"Successfully connected to database '{settings.DB_NAME}' on {settings.DB_HOST}:{settings.DB_PORT}."
    except Exception as e:
        return False, f"Failed to connect to database '{settings.DB_NAME}': {str(e)}"
