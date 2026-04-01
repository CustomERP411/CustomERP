"""
Base AI Client Interface

Abstract base class for AI clients. Allows swapping between different AI providers
(Gemini, OpenAI, fine-tuned models, etc.) without changing the service layer.
"""

from abc import ABC, abstractmethod
from typing import Optional, Type
from pydantic import BaseModel
from src.config import AgentConfig, settings


class BaseAIClient(ABC):
    """Abstract base class for AI clients.
    
    All AI client implementations (Gemini, OpenAI, fine-tuned, etc.) should
    inherit from this class and implement the required methods.
    """
    
    def __init__(self, agent_config: Optional[AgentConfig] = None):
        """Initialize the AI client.
        
        Args:
            agent_config: Optional agent-specific configuration. If not provided,
                         uses global defaults from settings.
        """
        self.agent_config = agent_config
        self._setup_client()
    
    @abstractmethod
    def _setup_client(self) -> None:
        """Set up the underlying AI client with appropriate credentials and config."""
        pass
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
        request_options: Optional[dict] = None,
    ) -> str:
        """Generate a response from the AI model.
        
        Args:
            prompt: The input prompt.
            temperature: Creativity level (0.0 = deterministic, 1.0 = creative).
                        If None, uses the agent's default temperature.
            json_mode: If True, configure the model for JSON output (legacy).
            response_schema: Pydantic model for strict JSON schema enforcement.
                            Takes precedence over json_mode when provided.
            request_options: Additional provider-specific options.
            
        Returns:
            The generated text response.
        """
        pass
    
    @abstractmethod
    async def generate_with_retry(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> str:
        """Generate a response with automatic retry on transient errors.
        
        Args:
            prompt: The input prompt.
            temperature: Creativity level. If None, uses the agent's default.
            json_mode: If True, configure the model for JSON output (legacy).
            response_schema: Pydantic model for strict JSON schema enforcement.
            
        Returns:
            The generated text response.
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test the connection to the AI service.
        
        Returns:
            True if connection is successful, False otherwise.
        """
        pass
    
    @abstractmethod
    def get_model_info(self) -> dict:
        """Get information about the current model configuration.
        
        Returns:
            Dict with model name, timeout, retries, and other config info.
        """
        pass
    
    def get_temperature(self, override: Optional[float] = None) -> float:
        """Get the temperature to use for generation.
        
        Args:
            override: If provided, use this temperature instead of the default.
            
        Returns:
            The temperature value to use.
        """
        if override is not None:
            return override
        if self.agent_config:
            return self.agent_config.temperature
        return 0.2  # Default
    
    def get_timeout(self) -> int:
        """Get the timeout to use for requests."""
        if self.agent_config:
            return self.agent_config.get_timeout(settings.AI_TIMEOUT_SECONDS)
        return settings.AI_TIMEOUT_SECONDS
    
    def get_max_retries(self) -> int:
        """Get the max retries for requests."""
        if self.agent_config:
            return self.agent_config.get_max_retries(settings.AI_MAX_RETRIES)
        return settings.AI_MAX_RETRIES
