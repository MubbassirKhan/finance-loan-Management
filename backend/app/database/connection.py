"""Database engine, session factory, and dependency injection.

Re-exports core functions from app.database.db for backward-compatibility and convenience.
"""
from app.database.db import (
    engine,
    SessionLocal,
    get_db,
    get_db_session,
    get_raw_connection,
    execute_query,
    execute_statement,
    check_connection,
)

__all__ = [
    "engine",
    "SessionLocal",
    "get_db",
    "get_db_session",
    "get_raw_connection",
    "execute_query",
    "execute_statement",
    "check_connection",
]
