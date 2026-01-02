"""
Gemini AI Client
Handles communication with Google's Gemini 2.5 Pro API
"""

import os
import asyncio
from typing import Optional
import google.generativeai as genai

from ..config import settings


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
        
        # Configure the API
        genai.configure(api_key=api_key)
        
        # Initialize the model
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
        temperature: float = 0.7, 
        json_mode: bool = False
    ) -> str:
        """
        Generate a response from the AI model.

        Args:
            prompt: The input prompt.
            temperature: Creativity level (0.0 = deterministic, 1.0 = creative).
            json_mode: If True, configure the model for JSON output.

        Returns:
            The generated text response.
        """
        try:
            config_params = {
                "temperature": temperature,
                "max_output_tokens": 8192,
            }
            if json_mode:
                config_params["response_mime_type"] = "application/json"

            generation_config = genai.GenerationConfig(**config_params)

            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=generation_config
            )
            
            return response.text
            
        except Exception as e:
            print(f"[GeminiClient] Generation error: {e}")
            raise
    
    
    async def generate_with_retry(
        self, 
        prompt: str, 
        temperature: float = 0.7,
        max_retries: Optional[int] = None,
        json_mode: bool = False
    ) -> str:
        """
        Generate with automatic retry on failure
        
        Args:
            prompt: The input prompt
            temperature: Creativity level
            max_retries: Number of retries (defaults to settings.AI_MAX_RETRIES)
        
        Returns:
            The generated text response
        """
        retries = max_retries or self.max_retries
        last_error = None
        
        for attempt in range(retries):
            try:
                return await self.generate(prompt, temperature, json_mode=json_mode)
            except Exception as e:
                last_error = e
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"[GeminiClient] Attempt {attempt + 1} failed: {e}")
                print(f"[GeminiClient] Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
        
        raise Exception(f"All {retries} attempts failed. Last error: {last_error}")
    
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

