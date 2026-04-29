"""Unit tests for the module precheck service (Plan D follow-up #8).

Covered behaviors:
- False-positive guard: descriptions whose ONLY HR-ish signal is
  platform-meta language (e.g. "5 people will use the system") never
  produce HR suggestions, even if the LLM ignored the prompt's GUARD.
- True-positive detection: descriptions naming actual HR business
  activities (payroll, leave) DO produce HR suggestions.
- Already-selected modules are filtered out.
- Language pass-through: a Turkish reason for a Turkish project is
  preserved untouched.
- JSON parsing is fault-tolerant (markdown fences, junk responses).
"""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from typing import List
from unittest.mock import AsyncMock

import pytest

from src.schemas.precheck import (
    InferredModule,
    PrecheckRequest,
    PrecheckResponse,
)
from src.services.precheck_service import (
    PrecheckService,
    _looks_like_platform_meta,
)


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_service(canned_text: str) -> PrecheckService:
    """Create a PrecheckService with a stub client whose
    ``generate_with_retry`` returns the supplied raw text. We bypass the
    real client init (which would need a provider key) by injecting the
    stub directly.
    """

    fake_client = SimpleNamespace(
        generate_with_retry=AsyncMock(return_value=SimpleNamespace(text=canned_text)),
        get_temperature=lambda: 0.2,
    )
    return PrecheckService(client=fake_client)


# ---------------------------------------------------------------------------
# False-positive guard (the user's specific concern)
# ---------------------------------------------------------------------------


def test_platform_meta_phrases_match_guard():
    """The defense-in-depth regex must match all known platform-meta
    cues — both English and Turkish.
    """

    positives = [
        "5 people will use the system to enter orders",
        "We have 12 system users that need access",
        "Number of users will be ~7",
        "Logins for our team are managed centrally",
        "Sistemi kullanacak 5 kişi var",
        "Sistemde kullanıcı sayısı 10",
    ]
    for phrase in positives:
        assert _looks_like_platform_meta(phrase), phrase

    negatives = [
        "We manage payroll for 12 staff",
        "Track stock at our two warehouses",
        "Issue invoices to customers and chase payments",
        "We sell pastries to walk-in customers",
        "12 personel için bordro hazırlıyoruz",
    ]
    for phrase in negatives:
        assert not _looks_like_platform_meta(phrase), phrase


async def test_precheck_strips_platform_meta_suggestion_even_if_llm_ignores_guard():
    """The LLM might fail to honor the prompt's GUARD section. The
    service-level filter must still drop suggestions whose `reason`
    text reveals platform-meta thinking.
    """

    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "hr",
                    "reason": "5 people will use the system, so HR is needed",
                    "confidence": "high",
                }
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="We sell baked goods. 5 people will use the system.",
        selected_modules=["inventory"],
        language="en",
    )

    response: PrecheckResponse = await service.precheck_modules(request)

    assert response.inferred_modules == []


# ---------------------------------------------------------------------------
# True-positive detection
# ---------------------------------------------------------------------------


async def test_precheck_keeps_genuine_hr_signal():
    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "hr",
                    "reason": "We manage payroll for 12 staff every month",
                    "confidence": "high",
                }
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="We manage payroll for 12 staff and sell pastries.",
        selected_modules=["inventory"],
        language="en",
    )

    response = await service.precheck_modules(request)

    assert len(response.inferred_modules) == 1
    suggestion = response.inferred_modules[0]
    assert suggestion.module == "hr"
    assert "payroll" in suggestion.reason.lower()
    assert suggestion.confidence == "high"


async def test_precheck_detects_invoice_when_billing_language_present():
    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "invoice",
                    "reason": "You bill customers and track AR balances",
                    "confidence": "medium",
                }
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="We bill customers and chase late payments.",
        selected_modules=["inventory"],
        language="en",
    )

    response = await service.precheck_modules(request)

    assert len(response.inferred_modules) == 1
    assert response.inferred_modules[0].module == "invoice"


# ---------------------------------------------------------------------------
# Already-selected filter
# ---------------------------------------------------------------------------


async def test_precheck_drops_modules_already_selected():
    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "hr",
                    "reason": "Payroll mentioned",
                    "confidence": "high",
                },
                {
                    "module": "inventory",
                    "reason": "You stock products",
                    "confidence": "medium",
                },
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="We do payroll and stock products.",
        selected_modules=["hr", "inventory"],
        language="en",
    )

    response = await service.precheck_modules(request)

    # Both suggestions duplicate the already-selected list, so nothing
    # should surface to the wizard.
    assert response.inferred_modules == []


# ---------------------------------------------------------------------------
# Language pass-through
# ---------------------------------------------------------------------------


async def test_precheck_preserves_turkish_reason():
    """The service does not translate the LLM's reason; it just passes
    it through. A Turkish project must surface a Turkish reason untouched.
    """

    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "hr",
                    "reason": "12 personel için bordro hazırlıyorsunuz",
                    "confidence": "high",
                }
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="12 personel için bordro hazırlıyoruz.",
        selected_modules=["inventory"],
        language="tr",
    )

    response = await service.precheck_modules(request)

    assert len(response.inferred_modules) == 1
    assert response.inferred_modules[0].reason == "12 personel için bordro hazırlıyorsunuz"


# ---------------------------------------------------------------------------
# Robustness
# ---------------------------------------------------------------------------


async def test_precheck_returns_empty_list_for_unparseable_llm_output():
    service = _build_service("not json at all — sorry")
    request = PrecheckRequest(
        business_description="we make pastries",
        selected_modules=["inventory"],
        language="en",
    )

    response = await service.precheck_modules(request)

    assert response.inferred_modules == []


async def test_precheck_normalizes_invalid_module_slugs():
    """The schema only allows hr/invoice/inventory. Anything else
    (e.g. an LLM hallucinating "crm") should be silently dropped.
    """

    llm_response = json.dumps(
        {
            "inferred_modules": [
                {
                    "module": "crm",
                    "reason": "tracks customers",
                    "confidence": "high",
                },
                {
                    "module": "invoice",
                    "reason": "issues invoices",
                    "confidence": "high",
                },
            ]
        }
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="we issue invoices to customers",
        selected_modules=[],
        language="en",
    )

    response = await service.precheck_modules(request)

    assert [m.module for m in response.inferred_modules] == ["invoice"]


async def test_precheck_unwraps_markdown_code_fences():
    llm_response = (
        "```json\n"
        + json.dumps(
            {
                "inferred_modules": [
                    {
                        "module": "hr",
                        "reason": "payroll for staff",
                        "confidence": "medium",
                    }
                ]
            }
        )
        + "\n```"
    )
    service = _build_service(llm_response)
    request = PrecheckRequest(
        business_description="we do payroll",
        selected_modules=[],
        language="en",
    )

    response = await service.precheck_modules(request)

    assert len(response.inferred_modules) == 1
    assert response.inferred_modules[0].module == "hr"
