"""Database initialization script to create tables."""
import logging
from app.database.connection import engine
from app.database.base import Base
# Import all models to register with Base.metadata
import app.models  # noqa: F401

logger = logging.getLogger("uvicorn.error")


def init_db() -> None:
    """Creates all database tables defined in the SQLAlchemy models."""
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_db()
