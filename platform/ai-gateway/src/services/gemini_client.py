"""
Gemini AI Client
Handles communication with Google's Gemini 2.5 Pro API
"""

import os
import asyncio
import time
from typing import Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from google.generativeai.types import GenerationConfig

from src.config import settings


class GeminiClient:
    """
    Client for interacting with Google Gemini AI
    
    Usage:
        client = GeminiClient()
        response = await client.generate("What is an ERP?")
    """
    
    _instance: Optional["GeminiClient"] = None
    
    def __init__(self):
        """Initialize the Gemini client with API key from environment"""
        api_key = settings.GOOGLE_AI_API_KEY
        
        if not api_key:
            raise ValueError(
                "GOOGLE_AI_API_KEY not set. "
                "Please set it in your .env file or environment variables."
            )
        
        genai.configure(api_key=api_key)
        
        self.model = genai.GenerativeModel(settings.GEMINI_MODEL)
        self.timeout = settings.AI_TIMEOUT_SECONDS
        self.max_retries = settings.AI_MAX_RETRIES
        
        print(f"[GeminiClient] Initialized with model: {settings.GEMINI_MODEL}")
    
    @classmethod
    def get_instance(cls) -> "GeminiClient":
        """Get singleton instance of GeminiClient"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def generate(
        self, 
        prompt: str, 
        temperature: float, 
        json_mode: bool = False, 
        request_options: dict = None
    ) -> str:
        """
        Generates content using the Gemini model.

        Args:
            prompt: The input prompt.
            temperature: Creativity level (0.0 = deterministic, 1.0 = creative).
            json_mode: If True, configure the model for JSON output.
            request_options: Additional options for the request.
        """
        try:
            config_params = {
                "temperature": temperature,
                "max_output_tokens": 8192,
            }
            if json_mode:
                config_params["response_mime_type"] = "application/json"

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
        json_mode: bool = False
    ) -> str:
        """Generates content with a retry mechanism for transient errors."""
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                print(f"[GeminiClient] Generating content (Attempt {attempt + 1}/{self.max_retries})...")
                request_options = {"timeout": self.timeout}
                response = await self.generate(
                    prompt,
                    temperature,
                    json_mode,
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
            "model": settings.GEMINI_MODEL,
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "api_configured": bool(settings.GOOGLE_AI_API_KEY)
        }

