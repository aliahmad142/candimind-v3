from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # VAPI Configuration
    vapi_api_key: str
    vapi_phone_number_id: str | None = None
    vapi_assistant_frontend_id: str | None = None
    vapi_assistant_backend_id: str | None = None
    
    # Database
    database_url: str = "sqlite:///./interviews.db"
    
    # Server URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    
    # Security
    secret_key: str
    
    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
