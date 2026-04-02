"""
Azure OpenAI Client (primary provider).

Uses the openai Python SDK's AsyncAzureOpenAI to call Azure-hosted
GPT-4o / GPT-4o-mini deployments.  Each agent can target a different
deployment (and therefore a different fine-tuned model in the future).
"""

import asyncio
from typing import Optional, Type

from openai import AsyncAzureOpenAI, APIConnectionError, APITimeoutError, RateLimitError
from pydantic import BaseModel

from src.config import settings, AgentConfig
from src.services.base_client import BaseAIClient, GenerationResult


class AzureOpenAIClient(BaseAIClient):
    """Client for Azure OpenAI Service."""

    def __init__(self, agent_config: Optional[AgentConfig] = None):
        super().__init__(agent_config)

    def _setup_client(self) -> None:
        if self.agent_config:
            api_key = self.agent_config.get_api_key(settings.AZURE_OPENAI_API_KEY)
            endpoint = self.agent_config.get_azure_endpoint(settings.AZURE_OPENAI_ENDPOINT)
            api_version = self.agent_config.get_azure_api_version(settings.AZURE_OPENAI_API_VERSION)
            self.deployment = self.agent_config.get_azure_deployment(settings.AZURE_OPENAI_DEPLOYMENT)
            self.model_name = self.agent_config.get_model(self.deployment)
        else:
            api_key = settings.AZURE_OPENAI_API_KEY
            endpoint = settings.AZURE_OPENAI_ENDPOINT
            api_version = settings.AZURE_OPENAI_API_VERSION
            self.deployment = settings.AZURE_OPENAI_DEPLOYMENT
            self.model_name = self.deployment

        if not api_key or not endpoint:
            raise ValueError(
                "Azure OpenAI not configured. Set AZURE_OPENAI_API_KEY and "
                "AZURE_OPENAI_ENDPOINT in your .env file."
            )

        self.client = AsyncAzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version,
            timeout=float(self.get_timeout()),
        )

        agent_name = self.agent_config.name if self.agent_config else "default"
        print(
            f"[AzureOpenAI:{agent_name}] Initialized — "
            f"endpoint={endpoint}, deployment={self.deployment}"
        )

    @property
    def timeout(self) -> int:
        return self.get_timeout()

    @property
    def max_retries(self) -> int:
        return self.get_max_retries()

    async def generate(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
        request_options: Optional[dict] = None,
    ) -> GenerationResult:
        temp = temperature if temperature is not None else self.get_temperature()

        kwargs: dict = {
            "model": self.deployment,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temp,
            "max_tokens": 8192,
        }

        if response_schema is not None or json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await self.client.chat.completions.create(**kwargs)
            text = response.choices[0].message.content or ""
            usage = response.usage
            return GenerationResult(
                text=text,
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                total_tokens=usage.total_tokens if usage else 0,
                model=response.model or self.deployment,
            )
        except Exception as e:
            print(f"[AzureOpenAI] Generation error: {e}")
            raise

    async def generate_with_retry(
        self,
        prompt: str,
        temperature: Optional[float] = None,
        json_mode: bool = False,
        response_schema: Optional[Type[BaseModel]] = None,
    ) -> GenerationResult:
        last_exception = None
        for attempt in range(self.max_retries):
            try:
                agent_name = self.agent_config.name if self.agent_config else "default"
                print(f"[AzureOpenAI:{agent_name}] Attempt {attempt + 1}/{self.max_retries}...")
                return await self.generate(
                    prompt, temperature, json_mode, response_schema=response_schema
                )
            except (APIConnectionError, APITimeoutError, RateLimitError, asyncio.TimeoutError) as e:
                print(f"[AzureOpenAI] Attempt {attempt + 1} transient error: {e}")
                last_exception = e
                if attempt == self.max_retries - 1:
                    break
                backoff = 2 ** (attempt + 1)
                print(f"[AzureOpenAI] Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
            except Exception as e:
                print(f"[AzureOpenAI] Non-retriable error: {e}")
                last_exception = e
                break

        print("[AzureOpenAI] All retry attempts failed.")
        raise last_exception

    async def test_connection(self) -> bool:
        try:
            result = await self.generate(
                "Respond with exactly: CONNECTION_OK", temperature=0.0
            )
            return "CONNECTION_OK" in result.text.upper()
        except Exception as e:
            print(f"[AzureOpenAI] Connection test failed: {e}")
            return False

    def get_model_info(self) -> dict:
        return {
            "provider": "azure_openai",
            "model": self.model_name,
            "deployment": self.deployment,
            "agent": self.agent_config.name if self.agent_config else "default",
            "timeout_seconds": self.timeout,
            "max_retries": self.max_retries,
            "api_configured": bool(
                settings.AZURE_OPENAI_API_KEY and settings.AZURE_OPENAI_ENDPOINT
            ),
        }
