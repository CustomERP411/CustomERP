"""Unit tests for the chatbot scope guard (Plan K §K2 / §K6).

Covers:
- ``looks_offtopic`` flags political, geographic, pop-culture, casual,
  sports, joke, and "who/what is …" questions in EN and TR.
- ``looks_offtopic`` keeps real ERP messages off the dropped list.
- ``strip_offtopic_features`` returns ``(kept=features, dropped=[])`` for
  ERP messages and ``(kept=[], dropped=features)`` for off-topic ones.
- ``strip_offtopic_features`` normalizes legacy string-shaped feature
  entries into the bilingual ``{name_en, name_native}`` object shape so
  downstream code only deals with one structure.

Test IDs follow the UC-7.5 convention used by the JS-side suites
(``TC-UC7.5-CHATSCOPE-NNN``) so cross-referencing in CI dashboards stays
predictable.
"""

from __future__ import annotations

from src.services.chat_scope_guard import (
    looks_offtopic,
    strip_offtopic_features,
)


# ---------------------------------------------------------------------------
# looks_offtopic — language and category coverage
# ---------------------------------------------------------------------------


class TestLooksOfftopic:
    """TC-UC7.5-CHATSCOPE-001..006 — pattern coverage."""

    def test_001_english_pop_culture_is_flagged(self) -> None:
        assert looks_offtopic("What's the best Netflix movie this year?") is True

    def test_002_english_political_question_is_flagged(self) -> None:
        assert looks_offtopic("Who is the current US president?") is True

    def test_003_english_weather_query_is_flagged(self) -> None:
        assert looks_offtopic("Weather in Istanbul today?") is True

    def test_004_turkish_offtopic_is_flagged(self) -> None:
        # "What is the capital of France" in Turkish.
        assert looks_offtopic("Fransa'nın başkenti nedir?") is True

    def test_005_turkish_casual_greeting_is_flagged(self) -> None:
        assert looks_offtopic("merhaba!") is True

    def test_006_real_erp_message_is_not_flagged(self) -> None:
        # An actual feature request the chatbot SHOULD record.
        assert (
            looks_offtopic(
                "I need to track payroll and leave balances for 50 employees."
            )
            is False
        )

    def test_007_empty_and_non_string_inputs_are_safe(self) -> None:
        assert looks_offtopic("") is False
        assert looks_offtopic(None) is False  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# strip_offtopic_features — kept/dropped split + normalization
# ---------------------------------------------------------------------------


class TestStripOfftopicFeatures:
    """TC-UC7.5-CHATSCOPE-010..016 — bucket split + shape normalization."""

    def test_010_erp_message_keeps_all_features(self) -> None:
        features = [
            {"name_en": "Time tracking", "name_native": "Zaman takibi"},
        ]
        kept, dropped = strip_offtopic_features(
            "We need shift-based time tracking for the warehouse team.",
            features,
        )
        assert kept == features
        assert dropped == []

    def test_011_offtopic_message_drops_all_features(self) -> None:
        # Even ERP-shaped feature labels are dropped when the *message*
        # is off-topic — this is the documented K2 behavior.
        features = [
            {"name_en": "Payroll", "name_native": "Bordro"},
            {"name_en": "Leave management", "name_native": "İzin yönetimi"},
        ]
        kept, dropped = strip_offtopic_features(
            "Tell me a joke about accountants",
            features,
        )
        assert kept == []
        assert dropped == features

    def test_012_legacy_string_features_are_normalized(self) -> None:
        # Pre-K builds emit `["X", "Y"]`; the guard must lift them into
        # the bilingual object shape so storage stays uniform.
        kept, dropped = strip_offtopic_features(
            "Add multi-warehouse stock transfer please.",
            ["Multi-warehouse stock transfer"],
        )
        assert kept == [
            {
                "name_en": "Multi-warehouse stock transfer",
                "name_native": "Multi-warehouse stock transfer",
            }
        ]
        assert dropped == []

    def test_013_partial_object_fields_are_filled_in(self) -> None:
        # When the LLM populates only one of name_en / name_native, the
        # other side mirrors it so downstream code never gets an empty
        # field.
        kept, _ = strip_offtopic_features(
            "Add invoice approvals.",
            [{"name_en": "Invoice approvals"}],
        )
        assert kept == [
            {"name_en": "Invoice approvals", "name_native": "Invoice approvals"}
        ]

    def test_014_blank_and_unknown_entries_are_dropped(self) -> None:
        kept, dropped = strip_offtopic_features(
            "We need approvals for purchase orders.",
            ["", {"name_en": ""}, None, 42, {"name_en": "PO approvals"}],
        )
        # The "42" coerces to a string ("42") and survives, since the
        # guard's job is shape normalization, not semantic validation.
        en_labels = [item["name_en"] for item in kept]
        assert "PO approvals" in en_labels
        assert "42" in en_labels
        assert "" not in en_labels
        assert dropped == []

    def test_015_empty_input_returns_two_empty_lists(self) -> None:
        kept, dropped = strip_offtopic_features("anything", [])
        assert kept == []
        assert dropped == []
