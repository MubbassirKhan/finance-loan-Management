import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


# Base project directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """Application runtime configurations loaded from environment variables."""

    # Project metadata
    PROJECT_NAME: str = "SP Office Membership and Fund Management System"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Security & Cryptography
    SECRET_KEY: str

    # Required connection string, supplied through environment or an ignored .env file
    DATABASE_URL: str

    # Session Management
    SESSION_COOKIE_NAME: str = "sp_admin_session"
    SESSION_EXPIRE_HOURS: int = 24
    SESSION_INACTIVITY_MINUTES: int = 60
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_HTTPONLY: bool = True

    # Initial Admin Seeding Credentials
    INITIAL_ADMIN_USERNAME: Optional[str] = None
    INITIAL_ADMIN_PASSWORD: Optional[str] = None

    # File Upload Restrictions
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: str = "pdf,jpg,jpeg,png"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # Rate limiting / brute-force protection
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_MINUTES: int = 15

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def db_url(self) -> str:
        """Returns the explicitly configured database URL."""
        database_url = self.DATABASE_URL.strip()
        if not database_url:
            raise ValueError("DATABASE_URL must not be empty.")
        return database_url

    @property
    def cors_origins(self) -> List[str]:
        """Return allowed CORS origins as a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def extensions_list(self) -> List[str]:
        """Return allowed upload file extensions as a lowercased list."""
        return [ext.strip().lower().lstrip(".") for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()]

    @property
    def is_production(self) -> bool:
        """Check if environment is production."""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def upload_path(self) -> Path:
        """Return absolute path to upload directory."""
        path = Path(self.UPLOAD_DIR)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path


# Global settings instance
settings = Settings()
