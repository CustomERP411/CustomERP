"""
Pytest fixtures for AI Gateway tests
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.gemini_client import GeminiClient

@pytest.fixture
def mock_gemini_client() -> MagicMock:
    """Fixture to create a mock GeminiClient.

    The mock simulates the behavior of the real client without making API calls.
    The `generate_with_retry` method is an AsyncMock to allow `await`.
    """
    mock = MagicMock(spec=GeminiClient)
    mock.generate_with_retry = AsyncMock()
    return mock
