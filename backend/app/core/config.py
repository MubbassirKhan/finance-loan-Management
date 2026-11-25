import os
import urllib.parse
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
    SECRET_KEY: str = "sp-office-dev-secret-key-change-in-production-2026"

    # Database connection parameters (as configured in pgAdmin / PostgreSQL 18)
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "abc@123"
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "financeDB"

    # Optional explicit connection string; if not supplied, auto-built from DB_* parameters
    DATABASE_URL: Optional[str] = None

    # Session Management
    SESSION_COOKIE_NAME: str = "sp_admin_session"
    SESSION_EXPIRE_HOURS: int = 24
    SESSION_INACTIVITY_MINUTES: int = 60
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_HTTPONLY: bool = True

    # Initial Admin Seeding Credentials
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = "admin@123"

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
        env_file=(str(BASE_DIR / ".env"), str(BASE_DIR / "backend" / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def db_url(self) -> str:
        """Returns the PostgreSQL connection URL with password safely URL-encoded.
        
        Handles special characters in passwords (such as '@' in 'abc@123' -> 'abc%40123')
        to prevent RFC 3986 URL parsing errors.
        """
        if self.DATABASE_URL and self.DATABASE_URL.strip():
            return self.DATABASE_URL.strip()

        # URL-encode the password to safely escape '@' or other special characters
        encoded_pw = urllib.parse.quote_plus(self.DB_PASSWORD)
        return f"postgresql+psycopg://{self.DB_USER}:{encoded_pw}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

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
