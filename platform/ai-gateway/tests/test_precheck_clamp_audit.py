"""Unit tests for the inferred_dropped_modules audit field
(Plan D follow-up #8 / D3.5).

Covers the union of two drop sources:
1. The orchestration clamp in `multi_agent_service` that strips modules
   from `distributor_output.modules_needed` before generators run.
2. The post-generation safety net in `sdf_service` that strips modules
   from the final SDF dict if anything sneaks through.

The audit field has to surface BOTH so users can audit what was
clamped, even when the upstream wizard precheck didn't catch it.
"""

from __future__ import annotations

import pytest

from src.schemas.multi_agent import PipelineResult
from src.schemas.sdf import SystemDefinitionFile


def test_pipeline_result_carries_inferred_dropped_modules_field():
    """The PipelineResult schema must accept and round-trip the new
    `inferred_dropped_modules` field. Default is an empty list (no
    drops happened)."""

    result = PipelineResult(success=True)
    assert hasattr(result, "inferred_dropped_modules")
    assert result.inferred_dropped_modules == []

    result_with_drops = PipelineResult(
        success=True, inferred_dropped_modules=["hr", "invoice"]
    )
    assert result_with_drops.inferred_dropped_modules == ["hr", "invoice"]


def test_sdf_schema_accepts_inferred_dropped_modules():
    """SystemDefinitionFile must accept the audit field so the gateway
    can pass the union of drops through to the backend (where it is
    persisted in the SDF JSONB column)."""

    sdf = SystemDefinitionFile.model_validate(
        {
            "project_name": "Acme",
            "entities": [
                {
                    "slug": "products",
                    "fields": [{"name": "name", "type": "string"}],
                }
            ],
            "inferred_dropped_modules": ["hr"],
        }
    )
    assert sdf.inferred_dropped_modules == ["hr"]


def test_sdf_schema_inferred_dropped_modules_is_optional():
    """Backwards compatibility: SDFs produced before Plan D do not have
    this field. The schema should accept their absence cleanly."""

    sdf = SystemDefinitionFile.model_validate(
        {
            "project_name": "Acme",
            "entities": [
                {
                    "slug": "products",
                    "fields": [{"name": "name", "type": "string"}],
                }
            ],
        }
    )
    assert sdf.inferred_dropped_modules is None


def test_pipeline_result_serializes_inferred_dropped_modules():
    """Ensure model_dump() emits the field — the backend reads the dump
    output, so a bug in serialization would silently drop the audit."""

    result = PipelineResult(success=True, inferred_dropped_modules=["hr"])
    data = result.model_dump()
    assert "inferred_dropped_modules" in data
    assert data["inferred_dropped_modules"] == ["hr"]


def test_sdf_dump_round_trips_audit_field_when_present():
    sdf = SystemDefinitionFile.model_validate(
        {
            "project_name": "Acme",
            "entities": [
                {
                    "slug": "products",
                    "fields": [{"name": "name", "type": "string"}],
                }
            ],
            "inferred_dropped_modules": ["hr", "invoice"],
        }
    )
    dumped = sdf.model_dump(exclude_none=True)
    assert dumped["inferred_dropped_modules"] == ["hr", "invoice"]


def test_sdf_dump_omits_audit_field_when_no_drops():
    """When no drops occurred we should not pollute the SDF with an
    empty / null audit entry."""

    sdf = SystemDefinitionFile.model_validate(
        {
            "project_name": "Acme",
            "entities": [
                {
                    "slug": "products",
                    "fields": [{"name": "name", "type": "string"}],
                }
            ],
        }
    )
    dumped = sdf.model_dump(exclude_none=True)
    assert "inferred_dropped_modules" not in dumped
