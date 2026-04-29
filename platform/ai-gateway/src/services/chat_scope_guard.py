"""Plan K — Chatbot scope guard.

Defense-in-depth filter that strips off-topic `unsupported_features[]`
emissions from the chat LLM. The Step 0 relevance gate inside the chat
prompt is the primary defense; this regex sweep catches the long tail
where the model still labels a casual / political / pop-culture user
message as a "missing feature".

Mirrors the pattern from
``platform/ai-gateway/src/services/precheck_service.py`` (Plan D §3.6) so
operators have a single mental model for both classifier-with-regex
defenses across the codebase.

The decision is taken on the **user message** rather than on the per-feature
label because:

1. Off-topic intent is a property of the question, not of the LLM's
   verbose feature names — the LLM is too creative to reliably regex.
2. Once the message is off-topic, ALL features for that turn are dropped
   together, which matches how a human reviewer would handle them.

Both kept and dropped lists are returned so the chat endpoint can surface
the dropped items in `dropped_unsupported_features` for transparency
(audit trail; compare with Plan D §3.5 ``inferred_dropped_modules``).
"""

from __future__ import annotations

import re
from typing import Any, List, Tuple

# Off-topic clusters — lower-cased on the message before matching, so the
# patterns themselves do not need explicit case-insensitivity beyond `\b`
# anchors. Patterns are intentionally conservative: if the message ALSO
# contains real ERP terms we still treat it as off-topic, since a single
# off-topic sentence among ERP context is unusual and almost always means
# the user veered off into chat.
_OFFTOPIC_PATTERNS: List[str] = [
    # Politics / public figures.
    r"\b(?:president|prime minister|politician|politik|cumhurba[sş]kan|ba[sş]bakan)\b",
    # Geography / weather / time-of-day.
    r"\bcapital of\b",
    r"\bweather (?:in|today|forecast)\b",
    r"\b(?:time|date) in [a-z]+\b",
    r"\bhava durum",
    r"\bba[sş]kent",
    # Pop culture / entertainment.
    r"\b(?:movie|movies|song|songs|celebrity|celebrities|netflix|spotify)\b",
    r"\b(?:dizi|[sş]ark[ıi]|film|filmler|sanat[cç][ıi])\b",
    # Personal-life / general-knowledge framing.
    r"\bnet ?worth\b",
    r"\bservet[ıi]?\b",
    r"\b(?:who is|what is|tell me about)\b",
    r"\b(?:kim ?dir|nedir|hakk[ıi]nda bilgi)\b",
    # Casual chat / greetings (whole-message, with or without trailing
    # punctuation/emoji).
    r"^(?:hi|hello|hey|yo|sup|merhaba|selam|naber)\b[\s!?.]*$",
    # Sports / general.
    r"\b(?:football|soccer|nba|fifa|world cup|champions league)\b",
    r"\b(?:futbol|basketbol|d[üu]nya kupas[ıi])\b",
    # Jokes / random.
    r"\btell me a joke\b",
    r"\b[fş]aka yap\b",
]

_OFFTOPIC_RE = re.compile("|".join(_OFFTOPIC_PATTERNS), re.IGNORECASE)


def looks_offtopic(message: str) -> bool:
    """Return True when the user message matches any off-topic pattern."""
    if not message or not isinstance(message, str):
        return False
    return bool(_OFFTOPIC_RE.search(message))


def strip_offtopic_features(
    message: str,
    features: List[Any],
) -> Tuple[List[dict], List[dict]]:
    """Split an LLM `unsupported_features` list into kept + dropped buckets.

    The decision is taken on the **user message** (Plan K §K2). When the
    message looks off-topic, ALL features from that turn are moved to the
    dropped bucket — even ones that look ERP-shaped on the surface — since
    they were extracted from a non-ERP question and persisting them would
    pollute the feature_requests admin view.

    The function also normalizes legacy string-shaped feature entries to
    the dual-language object shape so downstream code only has to handle
    one structure.

    Args:
        message: The raw user message that produced this turn.
        features: Whatever the LLM returned for `unsupported_features`.
            Strings, dicts, or a mixed list are all tolerated.

    Returns:
        ``(kept, dropped)`` where each entry is a dict with at least
        ``name_en`` and ``name_native``. ``dropped`` is non-empty only
        when the message was flagged off-topic.
    """
    normalized: List[dict] = []
    for entry in features or []:
        if isinstance(entry, str):
            label = entry.strip()
            if not label:
                continue
            normalized.append({"name_en": label, "name_native": label})
            continue
        if isinstance(entry, dict):
            name_en = str(entry.get("name_en") or entry.get("name") or "").strip()
            name_native = str(entry.get("name_native") or "").strip() or name_en
            if not name_en and not name_native:
                continue
            if not name_en:
                name_en = name_native
            if not name_native:
                name_native = name_en
            normalized.append({"name_en": name_en, "name_native": name_native})
            continue
        # Unknown shape — coerce to string so downstream isn't surprised.
        coerced = str(entry).strip()
        if coerced:
            normalized.append({"name_en": coerced, "name_native": coerced})

    if not normalized:
        return [], []

    if looks_offtopic(message):
        return [], normalized

    return normalized, []


__all__ = ["looks_offtopic", "strip_offtopic_features"]
