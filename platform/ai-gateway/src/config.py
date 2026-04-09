"""
Configuration module for AI Gateway

Supports multi-provider, multi-agent architecture.
Each agent (distributor, hr, invoice, inventory, integrator, chatbot) can have its own:
- Provider (azure_openai or gemini)
- API key / endpoint
- Model / deployment name
- Temperature, timeout, retries

Azure OpenAI is the primary provider; Gemini is the emergency fallback.
"""

import os
from dataclasses import dataclass, field
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


@dataclass
class AgentConfig:
    """Configuration for a single AI agent."""
    name: str
    provider: str = "azure_openai"
    api_key: Optional[str] = None
    model: Optional[str] = None
    temperature: float = 0.2
    timeout_seconds: Optional[int] = None
    max_retries: Optional[int] = None
    # Azure-specific
    azure_endpoint: Optional[str] = None
    azure_deployment: Optional[str] = None
    azure_api_version: Optional[str] = None
    
    def get_api_key(self, default: str) -> str:
        return self.api_key if self.api_key else default
    
    def get_model(self, default: str) -> str:
        return self.model if self.model else default
    
    def get_timeout(self, default: int) -> int:
        return self.timeout_seconds if self.timeout_seconds is not None else default
    
    def get_max_retries(self, default: int) -> int:
        return self.max_retries if self.max_retries is not None else default

    def get_azure_endpoint(self, default: str) -> str:
        return self.azure_endpoint if self.azure_endpoint else default

    def get_azure_deployment(self, default: str) -> str:
        return self.azure_deployment if self.azure_deployment else default

    def get_azure_api_version(self, default: str) -> str:
        return self.azure_api_version if self.azure_api_version else default


class Settings:
    """Application settings loaded from environment variables"""
    
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Provider selection (azure_openai | gemini)
    AI_DEFAULT_PROVIDER: str = os.getenv("AI_DEFAULT_PROVIDER", "azure_openai")
    
    # Google AI Configuration (fallback provider)
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # Azure OpenAI Configuration (primary provider)
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    
    # Request Configuration (Global defaults)
    AI_TIMEOUT_SECONDS: int = int(os.getenv("AI_TIMEOUT_SECONDS", "120"))
    AI_MAX_RETRIES: int = int(os.getenv("AI_MAX_RETRIES", "3"))
    
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def _load_agent_config(cls, agent_name: str, default_temperature: float = 0.2) -> AgentConfig:
        prefix = f"AI_AGENT_{agent_name.upper()}_"
        
        provider = os.getenv(f"{prefix}PROVIDER") or None
        api_key = os.getenv(f"{prefix}API_KEY") or None
        model = os.getenv(f"{prefix}MODEL") or None
        
        temp_str = os.getenv(f"{prefix}TEMPERATURE")
        temperature = float(temp_str) if temp_str else default_temperature
        
        timeout_str = os.getenv(f"{prefix}TIMEOUT")
        timeout = int(timeout_str) if timeout_str else None
        
        retries_str = os.getenv(f"{prefix}MAX_RETRIES")
        max_retries = int(retries_str) if retries_str else None
        
        azure_endpoint = os.getenv(f"{prefix}AZURE_ENDPOINT") or None
        azure_deployment = os.getenv(f"{prefix}AZURE_DEPLOYMENT") or None
        azure_api_version = os.getenv(f"{prefix}AZURE_API_VERSION") or None
        
        return AgentConfig(
            name=agent_name,
            provider=provider or cls.AI_DEFAULT_PROVIDER,
            api_key=api_key,
            model=model,
            temperature=temperature,
            timeout_seconds=timeout,
            max_retries=max_retries,
            azure_endpoint=azure_endpoint,
            azure_deployment=azure_deployment,
            azure_api_version=azure_api_version,
        )
    
    _agent_configs: dict[str, AgentConfig] = {}
    
    @classmethod
    def get_agent_config(cls, agent_name: str) -> AgentConfig:
        """Get configuration for a specific agent."""
        if agent_name not in cls._agent_configs:
            default_temps = {
                "distributor": 0.1,
                "hr": 0.2,
                "invoice": 0.2,
                "inventory": 0.2,
                "integrator": 0.1,
                "chatbot": 0.7,
            }
            cls._agent_configs[agent_name] = cls._load_agent_config(
                agent_name, 
                default_temps.get(agent_name, 0.2)
            )
        return cls._agent_configs[agent_name]
    
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
    def chatbot_config(cls) -> AgentConfig:
        return cls.get_agent_config("chatbot")
    
    @classmethod
    def validate(cls) -> list[str]:
        """Validate that at least one provider is configured."""
        errors = []
        has_azure = bool(cls.AZURE_OPENAI_API_KEY and cls.AZURE_OPENAI_ENDPOINT)
        has_gemini = bool(cls.GOOGLE_AI_API_KEY)
        
        if not has_azure and not has_gemini:
            errors.append(
                "No AI provider configured. Set AZURE_OPENAI_API_KEY + "
                "AZURE_OPENAI_ENDPOINT, or GOOGLE_AI_API_KEY."
            )
        
        if cls.AI_DEFAULT_PROVIDER == "azure_openai" and not has_azure:
            if has_gemini:
                print("[Config] WARNING: Azure OpenAI is default provider but not configured. Gemini available as fallback.")
            else:
                errors.append("AI_DEFAULT_PROVIDER is azure_openai but Azure credentials are missing.")
        
        return errors
    
    @classmethod
    def is_configured(cls) -> bool:
        return len(cls.validate()) == 0


settings = Settings()

