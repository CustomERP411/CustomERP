"""
Base AI Client Interface

Abstract base class for AI clients. Allows swapping between different AI providers
(Azure OpenAI, Gemini, fine-tuned models, etc.) without changing the service layer.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Type
from pydantic import BaseModel
from src.config import AgentConfig, settings


@dataclass
class GenerationResult:
    """Return value from every generate / generate_with_retry call.
    
    Carries the raw text *and* token-usage telemetry so the pipeline
    can accumulate costs per agent without parsing provider responses.
    """
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    model: str = ""


class BaseAIClient(ABC):
    """Abstract base class for AI clients."""
    
    def __init__(self, agent_config: Optional[AgentConfig] = None):
        self.agent_config = agent_config
        self._setup_client()
    
    @abstractmethod
    def _setup_client(self) -> None:
        pass
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
        request_options: Optional[dict] = None,
    ) -> GenerationResult:
        """Generate a response. Returns GenerationResult with text + token counts."""
        pass
    
    @abstractmethod
    async def generate_with_retry(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> GenerationResult:
        """Generate with automatic retry on transient errors."""
        pass
    
    @abstractmethod
    async def test_connection(self) -> bool:
        pass
    
    @abstractmethod
    def get_model_info(self) -> dict:
        pass
    
    def get_temperature(self, override: Optional[float] = None) -> float:
        if override is not None:
            return override
        if self.agent_config:
            return self.agent_config.temperature
        return 0.2
    
    def get_timeout(self) -> int:
        if self.agent_config:
            return self.agent_config.get_timeout(settings.AI_TIMEOUT_SECONDS)
        return settings.AI_TIMEOUT_SECONDS
    
    def get_max_retries(self) -> int:
        if self.agent_config:
            return self.agent_config.get_max_retries(settings.AI_MAX_RETRIES)
        return settings.AI_MAX_RETRIES
