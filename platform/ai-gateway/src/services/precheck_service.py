"""
Module Precheck Service (Plan D follow-up #8).

Single-call wrapper around the LLM that produces module suggestions from a
business description. Lives outside `multi_agent_service` so the heavyweight
distributor + module generator + integrator pipeline stays lean.

The endpoint deliberately accepts only the user's free-text description and
the modules the user has already selected. Wizard answers / metadata are
NEVER passed in, so platform-meta cues like "5 people will use the system"
cannot leak into the precheck reasoning. The prompt itself contains
explicit GUARD rules covering the residual cases the description language
might still surface.
"""

import json
import re
from typing import List, Optional, Set

from src.config import settings
from src.schemas.precheck import (
    InferredModule,
    PrecheckRequest,
    PrecheckResponse,
    SUPPORTED_CONFIDENCES,
    SUPPORTED_MODULES,
)
from src.services.azure_client import AzureOpenAIClient
from src.services.base_client import BaseAIClient
from src.services.gemini_client import GeminiClient
from src.prompts.sdf_generation import get_module_precheck_prompt


# ---------------------------------------------------------------------------
# Defense-in-depth GUARD: even if the LLM ignores the prompt's GUARD section,
# we strip suggestions whose `reason` is verbally about the system itself
# rather than the business. This protects against the user's specific
# concern: "how many people will use the system?" -> auto HR.
# ---------------------------------------------------------------------------
_PLATFORM_META_PATTERNS = [
    r"\bwill use the (?:system|app|platform)\b",
    r"\bsystem (?:user|users|account|accounts|login|logins)\b",
    r"\bplatform (?:user|users|account|accounts|login|logins)\b",
    r"\b(?:the )?(?:erp|platform) (?:itself|access)\b",
    r"\bnumber of (?:users|accounts|logins|seats)\b",
    r"\baccess to the (?:system|app|platform)\b",
    r"\bcount of (?:users|accounts|logins|seats)\b",
    r"\b(?:logins?|accounts?) for (?:our|the) (?:team|staff|company)\b",
    # Turkish equivalents — kept conservative so we do not strip valid HR
    # reasoning that happens to mention "kullanıcı" in context of payroll.
    r"\bsistemi kullan",
    r"\buygulamayı kullan",
    r"\bsistemde (?:kullanıcı|hesap|giriş)",
]
_PLATFORM_META_RE = re.compile("|".join(_PLATFORM_META_PATTERNS), re.IGNORECASE)


def _looks_like_platform_meta(reason: str) -> bool:
    if not reason:
        return False
    return bool(_PLATFORM_META_RE.search(reason))


class PrecheckService:
    """Runs the lightweight module-precheck LLM call."""

    def __init__(self, client: Optional[BaseAIClient] = None):
        self.client = client or self._create_client()

    @staticmethod
    def _create_client() -> BaseAIClient:
        # Reuse the distributor agent's client config — it is the lightest of
        # the multi-agent clients and runs on the same provider/model.
        config = settings.get_agent_config("distributor")
        if config.provider == "azure_openai":
            try:
                return AzureOpenAIClient(agent_config=config)
            except Exception as e:  # pragma: no cover (provider init failure)
                print(f"[PrecheckService] Azure client init failed: {e}")
                if settings.GOOGLE_AI_API_KEY:
                    return GeminiClient(agent_config=config)
                raise
        return GeminiClient(agent_config=config)

    async def precheck_modules(self, request: PrecheckRequest) -> PrecheckResponse:
        prompt = get_module_precheck_prompt(
            business_description=request.business_description,
            selected_modules=request.selected_modules,
            language=request.language,
        )
        result = await self.client.generate_with_retry(
            prompt,
            temperature=self.client.get_temperature(),
            json_mode=True,
        )
        data = self._parse_json_safe(result.text)
        return self._normalize(data, request.selected_modules)

    # ── helpers ─────────────────────────────────────────────────────────

    @staticmethod
    def _parse_json_safe(response: str) -> dict:
        """Tolerant JSON parsing — the LLM is allowed to wrap output in
        markdown fences. We pluck the first object and return `{}` on
        failure rather than raising, because precheck is advisory and a
        silent empty list is the safe answer."""
        if not response:
            return {}
        start = response.find("{")
        end = response.rfind("}")
        if start == -1 or end == -1:
            return {}
        try:
            return json.loads(response[start : end + 1])
        except (json.JSONDecodeError, ValueError):
            return {}

    @staticmethod
    def _normalize(
        data: dict, already_selected: List[str]
    ) -> PrecheckResponse:
        already: Set[str] = {str(s).lower() for s in (already_selected or [])}
        out: List[InferredModule] = []
        seen: Set[str] = set()
        raw = data.get("inferred_modules") if isinstance(data, dict) else None
        if not isinstance(raw, list):
            return PrecheckResponse(inferred_modules=[])
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            module = str(entry.get("module") or "").strip().lower()
            if module not in SUPPORTED_MODULES:
                continue
            if module in already:
                continue
            if module in seen:
                continue
            reason = str(entry.get("reason") or "").strip()
            if not reason:
                continue
            if _looks_like_platform_meta(reason):
                # Defense-in-depth: drop this suggestion silently.
                continue
            confidence = str(entry.get("confidence") or "medium").strip().lower()
            if confidence not in SUPPORTED_CONFIDENCES:
                confidence = "medium"
            out.append(
                InferredModule(
                    module=module, reason=reason, confidence=confidence
                )
            )
            seen.add(module)
        return PrecheckResponse(inferred_modules=out)
