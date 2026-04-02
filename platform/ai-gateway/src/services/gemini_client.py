"""
Gemini AI Client
Handles communication with Google's Gemini API (fallback provider).
"""

import asyncio
from typing import Optional, Type

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from google.generativeai.types import GenerationConfig
from pydantic import BaseModel

from src.config import settings, AgentConfig
from src.services.base_client import BaseAIClient, GenerationResult


class GeminiClient(BaseAIClient):
    """Client for interacting with Google Gemini AI."""
    
    _default_instance: Optional["GeminiClient"] = None
    
    def __init__(self, agent_config: Optional[AgentConfig] = None):
        super().__init__(agent_config)
    
    def _setup_client(self) -> None:
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
        return self.get_timeout()
    
    @property
    def max_retries(self) -> int:
        return self.get_max_retries()
    
    @classmethod
    def get_instance(cls) -> "GeminiClient":
        if cls._default_instance is None:
            cls._default_instance = cls()
        return cls._default_instance
    
    def _extract_usage(self, response) -> dict:
        """Extract token usage from Gemini response metadata."""
        try:
            meta = getattr(response, "usage_metadata", None)
            if meta:
                return {
                    "prompt": getattr(meta, "prompt_token_count", 0) or 0,
                    "completion": getattr(meta, "candidates_token_count", 0) or 0,
                    "total": getattr(meta, "total_token_count", 0) or 0,
                }
        except Exception:
            pass
        return {"prompt": 0, "completion": 0, "total": 0}
    
    async def generate(
        self, 
        prompt: str, 
        temperature: float, 
        json_mode: bool = False, 
        response_schema: Optional[Type[BaseModel]] = None,
        request_options: dict = None
    ) -> GenerationResult:
        try:
            config_params = {
                "temperature": temperature,
                "max_output_tokens": 8192,
            }
            
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
            
            usage = self._extract_usage(response)
            return GenerationResult(
                text=response.text,
                prompt_tokens=usage["prompt"],
                completion_tokens=usage["completion"],
                total_tokens=usage["total"],
                model=self.model_name,
            )
            
        except Exception as e:
            print(f"[GeminiClient] Generation error: {e}")
            raise
    
    async def generate_with_retry(
        self, 
        prompt: str, 
        temperature: float,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None
    ) -> GenerationResult:
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                print(f"[GeminiClient] Generating content (Attempt {attempt + 1}/{self.max_retries})...")
                request_options = {"timeout": self.timeout}
                result = await self.generate(
                    prompt,
                    temperature,
                    json_mode,
                    response_schema=response_schema,
                    request_options=request_options
                )
                return result
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
                print(f"[GeminiClient] A non-retriable error occurred: {e}")
                last_exception = e
                break
        
        print("[GeminiClient] All retry attempts failed.")
        raise last_exception
    
    async def test_connection(self) -> bool:
        try:
            result = await self.generate(
                "Respond with exactly: CONNECTION_OK",
                temperature=0.0
            )
            return "CONNECTION_OK" in result.text.upper() or "OK" in result.text.upper()
        except Exception as e:
            print(f"[GeminiClient] Connection test failed: {e}")
            return False
    
    def get_model_info(self) -> dict:
        return {
            "provider": "gemini",
            "model": self.model_name,
            "agent": self.agent_config.name if self.agent_config else "default",
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "api_configured": bool(settings.GOOGLE_AI_API_KEY)
        }

