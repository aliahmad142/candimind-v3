from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # VAPI Configuration
    vapi_api_key: str
    vapi_phone_number_id: str | None = None
    vapi_scholarship_assistant_id: str | None = None
    
    # Database
    database_url: str = "sqlite:///./interviews.db"
    
    # Server URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    
    # Security
    secret_key: str
    
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent / ".env"),
        case_sensitive=False
    )


def get_settings() -> Settings:
    """Get settings instance"""
    return Settings()
