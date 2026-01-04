"""
Configuration module for AI Gateway
Loads environment variables and provides configuration settings
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application settings loaded from environment variables"""
    
    # API Configuration
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Google AI Configuration
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    # Default to Gemini 1.5 Flash 002 - best free tier limits (15 RPM, 1M TPM, 1500 RPD)
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-002")
    
    # Request Configuration
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "60"))
    AI_MAX_RETRIES: int = int(os.getenv("AI_MAX_RETRIES", "3"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def validate(cls) -> list[str]:
        """Validate required configuration. Returns list of errors."""
        errors = []
        
        if not cls.GOOGLE_AI_API_KEY:
            errors.append("GOOGLE_AI_API_KEY is not set")
        
        return errors
    
    @classmethod
    def is_configured(cls) -> bool:
        """Check if all required settings are configured"""
        return len(cls.validate()) == 0


# Singleton instance
settings = Settings()

