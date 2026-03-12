"""
Configuration module for AI Gateway
Loads environment variables and provides configuration settings

Supports multi-agent architecture with per-agent configuration.
Each agent (distributor, hr, invoice, inventory, integrator) can have its own:
- API key
- Model
- Temperature
- Timeout

All default to shared values for now, but can be overridden via environment variables.
"""

import os
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


@dataclass
class AgentConfig:
    """Configuration for a single AI agent.
    
    Each agent can have its own model, API key, temperature, and timeout.
    If not specified, falls back to global defaults.
    """
    name: str
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.2
    timeout_seconds: Optional[int] = None
    max_retries: Optional[int] = None
    
    def get_api_key(self, default: str) -> str:
        """Get API key, falling back to default if not set."""
        return self.api_key if self.api_key else default
    
    def get_model(self, default: str) -> str:
        """Get model name, falling back to default if not set."""
        return self.model if self.model else default
    
    def get_timeout(self, default: int) -> int:
        """Get timeout, falling back to default if not set."""
        return self.timeout_seconds if self.timeout_seconds is not None else default
    
    def get_max_retries(self, default: int) -> int:
        """Get max retries, falling back to default if not set."""
        return self.max_retries if self.max_retries is not None else default


class Settings:
    """Application settings loaded from environment variables"""
    
    # API Configuration
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Google AI Configuration (Global defaults)
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    # Default to Gemini 1.5 Flash 002 - best free tier limits (15 RPM, 1M TPM, 1500 RPD)
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-002")
    
    # Request Configuration (Global defaults)
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "60"))
    AI_MAX_RETRIES: int = int(os.getenv("AI_MAX_RETRIES", "3"))
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # ─────────────────────────────────────────────────────────────
    # Multi-Agent Configuration
    # Each agent can override global settings via environment variables:
    #   AI_AGENT_{AGENT_NAME}_API_KEY
    #   AI_AGENT_{AGENT_NAME}_MODEL
    #   AI_AGENT_{AGENT_NAME}_TEMPERATURE
    #   AI_AGENT_{AGENT_NAME}_TIMEOUT
    #   AI_AGENT_{AGENT_NAME}_MAX_RETRIES
    # ─────────────────────────────────────────────────────────────
    
    @classmethod
    def _load_agent_config(cls, agent_name: str, default_temperature: float = 0.2) -> AgentConfig:
        """Load configuration for a specific agent from environment variables."""
        prefix = f"AI_AGENT_{agent_name.upper()}_"
        
        api_key = os.getenv(f"{prefix}API_KEY") or None
        model = os.getenv(f"{prefix}MODEL") or None
        
        temp_str = os.getenv(f"{prefix}TEMPERATURE")
        temperature = float(temp_str) if temp_str else default_temperature
        
        timeout_str = os.getenv(f"{prefix}TIMEOUT")
        timeout = int(timeout_str) if timeout_str else None
        
        retries_str = os.getenv(f"{prefix}MAX_RETRIES")
        max_retries = int(retries_str) if retries_str else None
        
        return AgentConfig(
            name=agent_name,
            api_key=api_key,
            model=model,
            temperature=temperature,
            timeout_seconds=timeout,
            max_retries=max_retries,
        )
    
    # Agent configurations (lazy-loaded)
    _agent_configs: dict[str, AgentConfig] = {}
    
    @classmethod
    def get_agent_config(cls, agent_name: str) -> AgentConfig:
        """Get configuration for a specific agent.
        
        Supported agents:
        - distributor: Routes user input to appropriate modules
        - hr: Generates HR-related SDF
        - invoice: Generates Invoice-related SDF
        - inventory: Generates Inventory-related SDF
        - integrator: Combines module outputs into final SDF
        """
        if agent_name not in cls._agent_configs:
            # Default temperatures per agent type
            default_temps = {
                "distributor": 0.1,  # More deterministic for routing
                "hr": 0.2,
                "invoice": 0.2,
                "inventory": 0.2,
                "integrator": 0.1,  # More deterministic for merging
            }
            cls._agent_configs[agent_name] = cls._load_agent_config(
                agent_name, 
                default_temps.get(agent_name, 0.2)
            )
        return cls._agent_configs[agent_name]
    
    # Convenience properties for each agent
    @classmethod
    def distributor_config(cls) -> AgentConfig:
        return cls.get_agent_config("distributor")
    
    @classmethod
    def hr_config(cls) -> AgentConfig:
        return cls.get_agent_config("hr")
    
    @classmethod
    def invoice_config(cls) -> AgentConfig:
        return cls.get_agent_config("invoice")
    
    @classmethod
    def inventory_config(cls) -> AgentConfig:
        return cls.get_agent_config("inventory")
    
    @classmethod
    def integrator_config(cls) -> AgentConfig:
        return cls.get_agent_config("integrator")
    
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

