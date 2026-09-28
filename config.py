"""
Kisan Web Project - Configuration Module
Supports production PostgreSQL databases with automatic fallback to SQLite for local development.
"""
import os
from datetime import timedelta

from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Load environment variables from .env file if available
load_dotenv(os.path.join(BASE_DIR, '.env'))


class Config:
    """Base application configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'kisan-secret-production-grade-flask-session-key-2026')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'kisan-super-secure-production-jwt-key-2026-sha256-standard')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    # Gemini API Configuration
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
    
    # Database Configuration: PostgreSQL default with fallback to local SQLite
    database_url = os.environ.get('DATABASE_URL')
    if database_url:
        # Normalize postgres:// to postgresql:// for SQLAlchemy compatibility
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        # Local development fallback
        db_path = os.path.join(BASE_DIR, 'kisan.db')
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{db_path}"

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
    } if database_url and "postgresql" in database_url else {}

    # File uploads
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

    # Cache expiration for weather (seconds)
    WEATHER_CACHE_TIMEOUT = 1800  # 30 minutes


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = False


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
