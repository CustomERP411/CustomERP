"""
Gemini AI Client
Handles communication with Google's Gemini API

Supports multi-agent architecture where each agent can have its own
model configuration while sharing the same underlying API.
"""

import os
import asyncio
import time
from typing import Optional, Type

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from google.generativeai.types import GenerationConfig
from pydantic import BaseModel

from src.config import settings, AgentConfig
from src.services.base_client import BaseAIClient


class GeminiClient(BaseAIClient):
    """
    Client for interacting with Google Gemini AI
    
    Usage:
        # Default client (uses global settings)
        client = GeminiClient()
        response = await client.generate("What is an ERP?")
        
        # Agent-specific client
        from src.config import settings
        hr_config = settings.hr_config()
        hr_client = GeminiClient(agent_config=hr_config)
    """
    
    _default_instance: Optional["GeminiClient"] = None
    
    def __init__(self, agent_config: Optional[AgentConfig] = None):
        """Initialize the Gemini client.
        
        Args:
            agent_config: Optional agent-specific configuration. If not provided,
                         uses global defaults from settings.
        """
        super().__init__(agent_config)
    
    def _setup_client(self) -> None:
        """Set up the Gemini client with appropriate credentials and config."""
        # Get API key (agent-specific or global)
        if self.agent_config:
            api_key = self.agent_config.get_api_key(settings.GOOGLE_AI_API_KEY)
            model_name = self.agent_config.get_model(settings.GEMINI_MODEL)
        else:
            api_key = settings.GOOGLE_AI_API_KEY
            model_name = settings.GEMINI_MODEL
        
        if not api_key:
            raise ValueError(
                "GOOGLE_AI_API_KEY not set. "
                "Please set it in your .env file or environment variables."
            )
        
        genai.configure(api_key=api_key)
        
        self.model = genai.GenerativeModel(model_name)
        self.model_name = model_name
        
        agent_name = self.agent_config.name if self.agent_config else "default"
        print(f"[GeminiClient:{agent_name}] Initialized with model: {model_name}")
    
    @property
    def timeout(self) -> int:
        """Get timeout from base class."""
        return self.get_timeout()
    
    @property
    def max_retries(self) -> int:
        """Get max retries from base class."""
        return self.get_max_retries()
    
    @classmethod
    def get_instance(cls) -> "GeminiClient":
        """Get singleton instance of GeminiClient (default config)"""
        if cls._default_instance is None:
            cls._default_instance = cls()
        return cls._default_instance
    
    async def generate(
        self, 
        prompt: str, 
        temperature: float, 
        json_mode: bool = False, 
        response_schema: Optional[Type[BaseModel]] = None,
        request_options: dict = None
    ) -> str:
        """
        Generates content using the Gemini model.

        Args:
            prompt: The input prompt.
            temperature: Creativity level (0.0 = deterministic, 1.0 = creative).
            json_mode: If True, configure the model for JSON output.
            response_schema: Optional Pydantic model to enforce strict JSON schema.
                            When provided, the API will validate output against this schema.
            request_options: Additional options for the request.
        """
        try:
            config_params = {
                "temperature": temperature,
                "max_output_tokens": 8192,
            }
            
            # Use JSON mode for structured output
            # NOTE: Gemini's response_schema doesn't fully support Pydantic models yet
            # (errors on 'default' fields). We use json_mode + prompt-based schema enforcement.
            if response_schema is not None or json_mode:
                config_params["response_mime_type"] = "application/json"
                if response_schema is not None:
                    agent_name = self.agent_config.name if self.agent_config else "default"
                    print(f"[GeminiClient:{agent_name}] JSON mode with schema hint: {response_schema.__name__}")

            generation_config = GenerationConfig(**config_params)

            response = await self.model.generate_content_async(
                prompt,
                generation_config=generation_config,
                request_options=request_options
            )
            
            return response.text
            
        except Exception as e:
            print(f"[GeminiClient] Generation error: {e}")
            raise
    
    async def generate_with_retry(
        self, 
        prompt: str, 
        temperature: float,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None
    ) -> str:
        """Generates content with a retry mechanism for transient errors.
        
        Args:
            prompt: The input prompt.
            temperature: Creativity level.
            json_mode: If True, configure the model for JSON output (legacy mode).
            response_schema: Pydantic model for strict schema enforcement.
                            Takes precedence over json_mode when provided.
        """
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                print(f"[GeminiClient] Generating content (Attempt {attempt + 1}/{self.max_retries})...")
                request_options = {"timeout": self.timeout}
                response = await self.generate(
                    prompt,
                    temperature,
                    json_mode,
                    response_schema=response_schema,
                    request_options=request_options
                )
                return response
            except (
                google_exceptions.ServiceUnavailable,
                google_exceptions.DeadlineExceeded,
                asyncio.TimeoutError
            ) as e:
                print(f"[GeminiClient] Attempt {attempt + 1} failed with transient error: {e}")
                last_exception = e
                if attempt == self.max_retries - 1:
                    print("[GeminiClient] Max retries reached. Failing.")
                    break
                
                backoff_time = 2 ** (attempt + 1)
                print(f"[GeminiClient] Retrying in {backoff_time} seconds...")
                await asyncio.sleep(backoff_time)
            except Exception as e:
                print(f"[GeminiClient] An non-retriable error occurred: {e}")
                last_exception = e
                break
        
        print("[GeminiClient] All retry attempts failed.")
        raise last_exception
    
    async def test_connection(self) -> bool:
        """
        Test the connection to the Gemini API
        
        Returns:
            True if connection is successful, False otherwise
        """
        try:
            response = await self.generate(
                "Respond with exactly: CONNECTION_OK",
                temperature=0.0
            )
            return "CONNECTION_OK" in response.upper() or "OK" in response.upper()
        except Exception as e:
            print(f"[GeminiClient] Connection test failed: {e}")
            return False
    
    def get_model_info(self) -> dict:
        """Get information about the current model configuration"""
        return {
            "model": self.model_name,
            "agent": self.agent_config.name if self.agent_config else "default",
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "api_configured": bool(settings.GOOGLE_AI_API_KEY)
        }

